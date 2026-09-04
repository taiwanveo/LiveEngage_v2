"""AI 旁路 stub 服務（AI-001~003；10s timeout、503 降級）。"""

from __future__ import annotations

import asyncio
import datetime as dt
import time
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode
from app.core.ids import uuid7
from app.models.enums import AiFeature
from app.models.sprint9 import AiRequestLog
from app.models.user import User
from app.schemas.ai import (
    AiGeneratePollsRequest,
    AiQuestionAssistRequest,
    AiRewriteRequest,
    AiStubResponse,
)
from app.schemas.poll import WordCount, WordVariant

_AI_TIMEOUT_S = 10.0


def _require_ai_key() -> None:
    settings = get_settings()
    if not settings.ai_api_key:
        raise AppError(
            ErrorCode.AI_UNAVAILABLE,
            "AI 服務未設定（缺少 ai_api_key）",
        )


async def _run_with_timeout(coro: Any) -> Any:
    """10 秒 timeout 包裝（鐵律：AI 旁路 timeout）。"""
    return await asyncio.wait_for(coro, timeout=_AI_TIMEOUT_S)


def _extract_json(text: str) -> dict[str, Any]:
    """安全解析 LLM 回應之 JSON（容錯 Markdown 代碼塊與前後贅字）。"""
    import json
    import re

    cleaned = text.strip()
    if "```" in cleaned:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
        if match:
            cleaned = match.group(1).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        # 嘗試尋找第一個 { 與最後一個 }
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise


def cluster_words_local(raw_words: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """離線降級／無金鑰時的語意聚合演算法（保證現場展示 100% 穩定可用）。"""
    if not raw_words:
        return []

    # 內建活動常用主題語意同義庫（支援繁中、簡中、英文常見詞彙）
    THEMES: list[tuple[str, list[str]]] = [
        (
            "生成式 AI 與工具",
            [
                "ai",
                "chatgpt",
                "gpt",
                "llm",
                "claude",
                "gemini",
                "人工智慧",
                "生成式",
                "prompt",
                "模型",
                "機器學習",
                "agent",
                "智慧",
                "copilot",
            ],
        ),
        (
            "工時與加班問題",
            [
                "加班",
                "工時",
                "爆肝",
                "熬夜",
                "休息",
                "過勞",
                "下班",
                "休假",
                "放假",
                "週末",
                "排班",
                "超時",
            ],
        ),
        (
            "薪資與福利待遇",
            [
                "薪水",
                "薪資",
                "低薪",
                "加薪",
                "調薪",
                "待遇",
                "獎金",
                "分紅",
                "福利",
                "年終",
                "股票",
                "配股",
            ],
        ),
        (
            "團隊溝通與協作",
            [
                "溝通",
                "協作",
                "主管",
                "團隊",
                "開會",
                "跨部門",
                "對齊",
                "回饋",
                "回報",
                "透明",
                "資訊不對稱",
            ],
        ),
        (
            "工作效率與自動化",
            [
                "效率",
                "工具",
                "自動化",
                "重複",
                "加速",
                "卡住",
                "效能",
                "優化",
                "流程",
                "系統慢",
                "繁瑣",
            ],
        ),
        (
            "職涯發展與成長",
            [
                "職涯",
                "升遷",
                "成長",
                "學習",
                "培訓",
                "進修",
                "技術",
                "專案",
                "挑戰",
                "未來",
            ],
        ),
    ]

    clusters: list[dict[str, Any]] = []
    assigned_indices: set[int] = set()

    # 1. 先用主題同義庫分群
    for theme_name, keywords in THEMES:
        matched_variants: list[dict[str, Any]] = []
        for i, item in enumerate(raw_words):
            if i in assigned_indices:
                continue
            w = str(item.get("word", "")).strip().casefold()
            cnt = int(item.get("count", 1))
            if any(k in w for k in keywords):
                matched_variants.append(
                    {"word": str(item.get("word", "")).strip(), "count": cnt}
                )
                assigned_indices.add(i)

        if matched_variants:
            matched_variants.sort(key=lambda x: -x["count"])
            total_cnt = sum(v["count"] for v in matched_variants)
            clusters.append(
                {
                    "word": theme_name,
                    "count": total_cnt,
                    "variants": matched_variants,
                }
            )

    # 2. 對於未歸類的詞彙，進行子字串或前綴聚合
    unassigned = [
        (i, raw_words[i])
        for i in range(len(raw_words))
        if i not in assigned_indices
    ]

    sub_clusters: list[list[dict[str, Any]]] = []
    for orig_idx, item in unassigned:
        word_text = str(item.get("word", "")).strip()
        cnt = int(item.get("count", 1))
        word_folded = word_text.casefold()

        placed = False
        for group in sub_clusters:
            rep = group[0]["word"].casefold()
            if (
                word_folded == rep
                or (len(rep) >= 2 and rep in word_folded)
                or (len(word_folded) >= 2 and word_folded in rep)
            ):
                group.append({"word": word_text, "count": cnt})
                placed = True
                break
        if not placed:
            sub_clusters.append([{"word": word_text, "count": cnt}])

    for group in sub_clusters:
        group.sort(key=lambda x: -x["count"])
        total_cnt = sum(v["count"] for v in group)
        rep_word = group[0]["word"]
        clusters.append(
            {
                "word": rep_word,
                "count": total_cnt,
                "variants": group,
            }
        )

    # 3. 依總票數降序排序
    clusters.sort(key=lambda x: -x["count"])
    return clusters


async def _log_request(
    db: AsyncSession,
    *,
    user: User | None = None,
    org_id: Any = None,
    feature: AiFeature,
    status: str,
    latency_ms: int,
    details: dict[str, Any],
) -> None:
    target_org_id = user.org_id if user else org_id
    if not target_org_id:
        return
    now = dt.datetime.now(dt.UTC)
    db.add(
        AiRequestLog(
            id=uuid7(),
            org_id=target_org_id,
            user_id=user.id if user else None,
            feature=feature,
            status=status,
            latency_ms=latency_ms,
            is_ai_generated=True,
            details_jsonb=details,
            created_at=now,
        )
    )
    await db.commit()


async def _stub_llm_call(feature: AiFeature, payload: dict[str, Any]) -> dict[str, Any]:
    """Placeholder：模擬外部 LLM 延遲或執行離線規則分群。"""

    async def _inner() -> dict[str, Any]:
        await asyncio.sleep(0.05)
        if feature == AiFeature.CLUSTER_WORDS:
            return {"clusters": cluster_words_local(payload.get("words", []))}
        if feature == AiFeature.GENERATE_POLLS:
            count = int(payload.get("count", 3))
            return {
                "polls": [
                    {
                        "title": f"（AI stub）關於「{payload.get('topic', '')}」的問題 {i + 1}",
                        "options": ["選項 A", "選項 B", "選項 C"],
                    }
                    for i in range(count)
                ]
            }
        if feature == AiFeature.REWRITE:
            return {"text": f"（AI stub）{payload.get('text', '')}"}
        if feature == AiFeature.QUESTION_ASSIST:
            return {
                "suggestions": [
                    f"（AI stub）延伸：{payload.get('question', '')}",
                ]
            }
        return {"message": "stub"}

    return await _run_with_timeout(_inner())


async def _real_llm_call(feature: AiFeature, payload: dict[str, Any]) -> dict[str, Any]:
    """支援 OpenAI / OpenRouter / Gemini / 任意相容 API 的 Chat Completions。"""
    import json
    import httpx

    settings = get_settings()
    if feature == AiFeature.GENERATE_POLLS:
        prompt = (
            f"Generate {payload.get('count', 3)} poll questions about "
            f"「{payload.get('topic', '')}」. Context: {payload.get('context', '')}. "
            'Return JSON: {"polls":[{"title":"...","options":["A","B","C"]}]}'
        )
    elif feature == AiFeature.REWRITE:
        prompt = (
            f"Rewrite in tone {payload.get('tone', 'neutral')}: "
            f"{payload.get('text', '')}. Return JSON: {{\"text\":\"...\"}}"
        )
    elif feature == AiFeature.CLUSTER_WORDS:
        words_json = json.dumps(payload.get("words", []), ensure_ascii=False)
        prompt = (
            "You are an AI assistant for a live audience interaction system. "
            "Below is a JSON list of words and their counts from a live audience word cloud:\n"
            f"{words_json}\n\n"
            "Task: Group semantically identical, synonymous, or closely related words into coherent clusters. "
            "Requirements:\n"
            "1. Every input word must appear in exactly one cluster's 'variants' list.\n"
            "2. 'word' of each cluster should be a clean, concise, representative summary label (in Traditional Chinese if inputs are Chinese, or matching source language).\n"
            "3. 'count' of each cluster must be the exact sum of counts of all its variants.\n"
            "4. Unrelated words remain their own single-word cluster with themselves as the variant.\n"
            "5. Sort clusters by count descending.\n"
            "6. Return JSON strictly in this format: "
            '{"clusters": [{"word": "代表詞", "count": 總票數, "variants": [{"word": "原始詞", "count": 票數}]}]}'
        )
    else:
        prompt = (
            f"Suggest follow-up questions for: {payload.get('question', '')}. "
            f"Context: {payload.get('context', '')}. "
            'Return JSON: {"suggestions":["..."]}'
        )

    headers = {
        "Authorization": f"Bearer {settings.ai_api_key}",
        "Content-Type": "application/json",
    }
    if settings.ai_provider == "openrouter" or "openrouter.ai" in settings.ai_base_url:
        headers["HTTP-Referer"] = "https://liveengage.pages.dev"
        headers["X-Title"] = "LiveEngage v2"

    async with httpx.AsyncClient(timeout=9.0) as client:
        resp = await client.post(
            f"{settings.ai_base_url.rstrip('/')}/chat/completions",
            headers=headers,
            json={
                "model": settings.ai_model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that outputs only valid JSON.",
                    },
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
            },
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        return _extract_json(content)


async def _llm_call(feature: AiFeature, payload: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    if settings.ai_enabled and settings.ai_api_key:
        try:
            return await _run_with_timeout(_real_llm_call(feature, payload))
        except Exception:
            pass
    return await _stub_llm_call(feature, payload)


async def generate_polls(
    db: AsyncSession,
    *,
    user: User,
    payload: AiGeneratePollsRequest,
) -> AiStubResponse:
    """AI-001：依主題產生 Poll 草稿。"""
    _require_ai_key()
    started = time.perf_counter()
    try:
        result = await _llm_call(
            AiFeature.GENERATE_POLLS,
            {"topic": payload.topic, "count": payload.count, "context": payload.context},
        )
        status = "ok"
    except TimeoutError as exc:
        raise AppError(ErrorCode.AI_UNAVAILABLE, "AI 請求逾時") from exc
    latency_ms = int((time.perf_counter() - started) * 1000)
    await _log_request(
        db,
        user=user,
        feature=AiFeature.GENERATE_POLLS,
        status=status,
        latency_ms=latency_ms,
        details={"topic": payload.topic, "count": payload.count},
    )
    return AiStubResponse(result=result, latency_ms=latency_ms)


async def rewrite(
    db: AsyncSession,
    *,
    user: User,
    payload: AiRewriteRequest,
) -> AiStubResponse:
    """AI-002：改寫文字。"""
    _require_ai_key()
    started = time.perf_counter()
    try:
        result = await _llm_call(
            AiFeature.REWRITE,
            {"text": payload.text, "tone": payload.tone},
        )
        status = "ok"
    except TimeoutError as exc:
        raise AppError(ErrorCode.AI_UNAVAILABLE, "AI 請求逾時") from exc
    latency_ms = int((time.perf_counter() - started) * 1000)
    await _log_request(
        db,
        user=user,
        feature=AiFeature.REWRITE,
        status=status,
        latency_ms=latency_ms,
        details={"tone": payload.tone},
    )
    return AiStubResponse(result=result, latency_ms=latency_ms)


async def question_assist(
    db: AsyncSession,
    *,
    user: User,
    payload: AiQuestionAssistRequest,
) -> AiStubResponse:
    """AI-003：Q&A 提問輔助。"""
    _require_ai_key()
    started = time.perf_counter()
    try:
        result = await _llm_call(
            AiFeature.QUESTION_ASSIST,
            {"question": payload.question, "context": payload.context},
        )
        status = "ok"
    except TimeoutError as exc:
        raise AppError(ErrorCode.AI_UNAVAILABLE, "AI 請求逾時") from exc
    latency_ms = int((time.perf_counter() - started) * 1000)
    await _log_request(
        db,
        user=user,
        feature=AiFeature.QUESTION_ASSIST,
        status=status,
        latency_ms=latency_ms,
        details={"question_len": len(payload.question)},
    )
    return AiStubResponse(result=result, latency_ms=latency_ms)


async def cluster_word_cloud(
    db: AsyncSession,
    *,
    user: User | None = None,
    org_id: Any = None,
    words: list[WordCount],
) -> list[WordCount]:
    """AI 語意聚合：將文字雲同義、相似或碎片化的詞彙聚合成主題詞群。"""
    if not words:
        return []

    started = time.perf_counter()
    raw_payload = [{"word": w.word, "count": w.count} for w in words]
    status = "ok"
    clusters_data: list[dict[str, Any]] = []

    try:
        res = await _llm_call(
            AiFeature.CLUSTER_WORDS,
            {"words": raw_payload},
        )
        if isinstance(res, dict) and "clusters" in res and isinstance(res["clusters"], list):
            clusters_data = res["clusters"]
        else:
            clusters_data = cluster_words_local(raw_payload)
    except Exception:
        status = "fallback"
        clusters_data = cluster_words_local(raw_payload)

    latency_ms = int((time.perf_counter() - started) * 1000)
    await _log_request(
        db,
        user=user,
        org_id=org_id,
        feature=AiFeature.CLUSTER_WORDS,
        status=status,
        latency_ms=latency_ms,
        details={"raw_word_count": len(words), "cluster_count": len(clusters_data)},
    )

    # 轉為 WordCount schema 列表，確保資料完整與型別安全
    results: list[WordCount] = []
    for item in clusters_data:
        cluster_word = str(item.get("word", "")).strip()
        variants_raw = item.get("variants", [])
        variants: list[WordVariant] = []
        if isinstance(variants_raw, list):
            for v in variants_raw:
                if isinstance(v, dict):
                    v_word = str(v.get("word", "")).strip()
                    v_cnt = int(v.get("count", 1))
                    if v_word:
                        variants.append(WordVariant(word=v_word, count=v_cnt))

        # 若 cluster 內無 variants，則將自身作為單一 variant
        if not variants and cluster_word:
            variants.append(WordVariant(word=cluster_word, count=int(item.get("count", 1))))

        total_cnt = sum(v.count for v in variants) if variants else int(item.get("count", 1))
        results.append(
            WordCount(
                word=cluster_word or "綜合意見",
                count=total_cnt,
                variants=variants,
                is_ai_clustered=True,
            )
        )

    results.sort(key=lambda x: -x.count)
    return results

