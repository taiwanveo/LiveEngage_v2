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
    ActionRecommendation,
    AiConfigOverride,
    AiDecisionReport,
    AiDedupQuestionsResponse,
    AiGeneratedPollItem,
    AiGeneratePollsRequest,
    AiGeneratePollsResponse,
    AiQuestionAssistRequest,
    AiQuestionCluster,
    AiQuestionItem,
    AiRewriteRequest,
    AiStubResponse,
    DecisionConsensus,
    DecisionDivergence,
    UnansweredTopQuestion,
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


def generate_decision_report_local(data: dict[str, Any]) -> dict[str, Any]:
    """離線／降級生成高品質決策報告（確保在無 API Key 或網路異常時 100% 產出商業簡報級報告）。"""
    session_info = data.get("session", {})
    session_id = session_info.get("id", "")
    session_title = session_info.get("title", "LiveEngage 活動會議")
    session_code = session_info.get("code", "")

    eng = data.get("engagement", {})
    participant_count = eng.get("participant_count", 0)
    participants_engaged = eng.get("participants_engaged", 0)
    engaged_percent = eng.get("engaged_percent", 0)
    qa_total = eng.get("qa_questions_total", 0)
    poll_votes_total = eng.get("poll_votes_total", 0)

    polls = data.get("polls", [])
    questions = data.get("questions", {})
    top_questions = questions.get("top_upvoted", [])
    unanswered_q = questions.get("unanswered", [])
    answered_cnt = questions.get("answered_count", 0)

    # 1. 互動率評級
    if engaged_percent >= 75:
        engagement_rating = f"卓越 ({engaged_percent}%) — 全員深度參與，互動熱度極高"
    elif engaged_percent >= 50:
        engagement_rating = f"良好 ({engaged_percent}%) — 多數參與者積極投入，有效引導思維碰撞"
    elif engaged_percent >= 25:
        engagement_rating = f"普通 ({engaged_percent}%) — 具備基本反饋，建議增加互動引導"
    else:
        engagement_rating = f"起步 ({engaged_percent}%) — 建議優化破冰環節以提高參與動機"

    # 2. 關鍵共識歸納
    consensuses: list[dict[str, str]] = []
    for p in polls:
        p_title = p.get("title", "")
        options = p.get("options", [])
        word_counts = p.get("word_counts", [])
        avg_rating = p.get("rating_average")

        if options:
            sorted_opts = sorted(options, key=lambda x: -x.get("count", 0))
            if sorted_opts and sorted_opts[0].get("count", 0) > 0:
                top_opt = sorted_opts[0]
                total_votes = sum(o.get("count", 0) for o in options)
                pct = round(top_opt["count"] / total_votes * 100) if total_votes > 0 else 0
                consensuses.append({
                    "title": f"多數支持「{top_opt['text']}」",
                    "evidence": f"在「{p_title}」投票中，獲得 {top_opt['count']} 票（佔整體有效票 {pct}%）。",
                    "impact": f"確立團隊對於『{top_opt['text']}』具有強烈傾向，適合作為主要實施路徑。",
                })
        elif word_counts:
            top_word = word_counts[0]
            w_text = top_word.get("word", "")
            w_count = top_word.get("count", 0)
            variants = [v.get("word", "") for v in top_word.get("variants", [])[:3] if v.get("word")]
            var_str = f"（涵蓋同義詞：{', '.join(variants)}）" if variants else ""
            consensuses.append({
                "title": f"開放意向高度聚焦於「{w_text}」",
                "evidence": f"文字雲聚合中，「{w_text}」累計獲得 {w_count} 次提及{var_str}。",
                "impact": f"反映現場觀眾心智模型的核心認知，溝通時應優先以此關鍵維度切入。",
            })
        elif avg_rating is not None:
            sentiment = "高度正面認可" if avg_rating >= 4.0 else ("偏向中立或保留" if avg_rating >= 3.0 else "需重點關注與改善")
            consensuses.append({
                "title": f"整體滿意度指數：{avg_rating:.1f} / 5.0 星",
                "evidence": f"題目「{p_title}」之參與者平均給予 {avg_rating:.1f} 分。",
                "impact": f"群體情緒對當前議題呈現{sentiment}，為後續推行提供明確信心基礎。",
            })

    if not consensuses:
        consensuses.append({
            "title": "團隊對會議核心目標建立初始對齊",
            "evidence": f"現場共 {participant_count} 人上線，參與率達 {engaged_percent}%，累計收集 {poll_votes_total} 次互動。",
            "impact": "主要利害關係人已掌握會議主軸，為進一步細部對齊奠定基礎。",
        })

    # 3. 議題分歧與拉鋸點
    divergences: list[dict[str, str]] = []
    for p in polls:
        options = p.get("options", [])
        if len(options) >= 2:
            sorted_opts = sorted(options, key=lambda x: -x.get("count", 0))
            opt1, opt2 = sorted_opts[0], sorted_opts[1]
            cnt1, cnt2 = opt1.get("count", 0), opt2.get("count", 0)
            if cnt1 > 0 and cnt2 > 0 and (cnt1 - cnt2) <= max(2, round(cnt1 * 0.35)):
                divergences.append({
                    "topic": f"題目「{p.get('title', '')}」之選項拉鋸",
                    "description": f"「{opt1['text']}」（{cnt1} 票）與「{opt2['text']}」（{cnt2} 票）票數相當接近，群眾意見未完全收斂。",
                    "suggested_compromise": f"建議採取階段性試行方案，以「{opt1['text']}」為主架構，並融入「{opt2['text']}」之配套彈性。",
                })

    for q in top_questions:
        c = q.get("content", "")
        up = q.get("upvotes", q.get("score", 0))
        if up >= 2 and any(kw in c for kw in ["但是", "可是", "時程", "成本", "風險", "怎麼可能", "為何", "如何兼顧", "挑戰"]):
            divergences.append({
                "topic": f"執行挑戰疑慮：{c[:22]}...",
                "description": f"此問題獲得 {up} 個觀眾附議認同，指出實務推行可能面臨之阻力或資源瓶頸。",
                "suggested_compromise": "建議會後由技術或負責主管提供具體時程排程與風險應對方案（FAQ）。",
            })
            if len(divergences) >= 2:
                break

    if not divergences:
        divergences.append({
            "topic": "時程與資源分配之細節對齊",
            "description": "現場整體意向趨於一致，但不同團隊在實際投入資源與交付節奏上可能仍有潛在期待落差。",
            "suggested_compromise": "於專案 kick-off 時明確訂定交付節點與驗收標準，確保透明度與責任歸屬。",
        })

    # 4. 未解答高關注提問
    unanswered_list: list[dict[str, Any]] = []
    for q in unanswered_q[:3]:
        unanswered_list.append({
            "question": q.get("content", ""),
            "upvotes": q.get("upvotes", q.get("score", 0)),
            "why_important": f"獲得現場 {q.get('upvotes', q.get('score', 0))} 名參與者點贊支持，代表多數觀眾共有的核心疑慮。",
            "suggested_response_direction": "由主辦方或主講人於會後 48 小時內統整書面回覆並發布於公告管道。",
        })

    # 5. 建議行動清單 (Action Items)
    actions: list[dict[str, str]] = [
        {
            "owner": "活動主持人 / 會議主席",
            "action": "發布會後決策報告與紀要，同步結論至全體利害關係人與內部頻道。",
            "priority": "high",
            "timeline": "會後 24 小時內",
        },
        {
            "owner": "專案負責人 (PM)",
            "action": f"依據「{consensuses[0]['title']}」之共識結論，拆解第一階段具體規格與排程任務。",
            "priority": "high",
            "timeline": "本週五前",
        },
        {
            "owner": "技術 / 執行單位",
            "action": "針對會中未解答之技術與架構疑問發布說明手冊，消除落地疑慮。",
            "priority": "medium",
            "timeline": "下週二前",
        },
        {
            "owner": "各部門代表",
            "action": "檢視本會議之共識，對齊團隊內部 Q3/Q4 OKR 與資源分配。",
            "priority": "medium",
            "timeline": "兩週內",
        },
    ]

    # 6. Executive Summary
    summary = (
        f"本次「{session_title}」（代碼 #{session_code}）共有 {participant_count} 位成員參與，"
        f"整體互動參與率達 {engaged_percent}%，累計收集 {poll_votes_total} 筆投票回饋與 {qa_total} 則即時提問。\n\n"
        f"在核心決策面向，全場已展現清晰意向，其中「{consensuses[0]['title']}」成為最高共識核心。"
        f"然而，在「{divergences[0]['topic']}」等方面仍有不同觀點角力，需透過彈性分階段配套予以化解。\n\n"
        f"針對現場遺留之 {len(unanswered_q)} 則未解答熱門問題，建議透過會後追蹤清單在 48 小時內提供補充說明，"
        f"以延續高度團隊共創動能，確保後續執行無縫推進。"
    )

    # 7. Markdown Content
    now_str = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    md_lines = [
        f"# 📊 【AI 決策報告】{session_title}",
        f"> **生成時間**：`{now_str}` ｜ **會議代碼**：`#{session_code}` ｜ **由 LiveEngage v2 智能決策引擎生成**\n",
        "---",
        "## 📈 會議互動指標 (Key Metrics)",
        "| 指標項目 | 數據數值 | 表現評級 |",
        "| :--- | :--- | :--- |",
        f"| **與會總人數** | `{participant_count}` 人 | - |",
        f"| **主動互動人數** | `{participants_engaged}` 人 | **參與率 {engaged_percent}%** |",
        f"| **投票與回饋總數** | `{poll_votes_total}` 票 | 數據樣本充足 |",
        f"| **提問總數 (Q&A)** | `{qa_total}` 則 | 已解答 `{answered_cnt}` 則 |",
        f"| **整體參與指數** | - | **{engagement_rating}** |\n",
        "## 🎯 執行摘要 (Executive Summary)",
        summary,
        "\n---",
        "## 💡 關鍵共識分析 (Key Consensuses)",
    ]
    for i, c in enumerate(consensuses, 1):
        md_lines.extend([
            f"### {i}. {c['title']}",
            f"- **數據佐證**：{c['evidence']}",
            f"- **決策意涵**：{c['impact']}",
        ])

    md_lines.extend([
        "\n---",
        "## ⚖️ 議題分歧與拉鋸點 (Points of Divergence)",
    ])
    for i, d in enumerate(divergences, 1):
        md_lines.extend([
            f"### {i}. {d['topic']}",
            f"- **分歧現況**：{d['description']}",
            f"- **建議平衡解法**：{d['suggested_compromise']}",
        ])

    if unanswered_list:
        md_lines.extend([
            "\n---",
            "## ❓ 觀眾高度關注之未解答焦點 (Top Unanswered Concerns)",
        ])
        for i, u in enumerate(unanswered_list, 1):
            md_lines.extend([
                f"### {i}. 「{u['question']}」 *(👍 {u['upvotes']} 票認同)*",
                f"- **關注重要性**：{u['why_important']}",
                f"- **建議回覆方向**：{u['suggested_response_direction']}",
            ])

    md_lines.extend([
        "\n---",
        "## 🚀 建議行動追蹤清單 (Action Items & Next Steps)",
        "| 優先級 | 負責人 / 角色 | 具體行動方針 | 預計完成時限 |",
        "| :---: | :--- | :--- | :--- |",
    ])
    priority_map = {"high": "🔴 高", "medium": "🟡 中", "low": "🟢 低"}
    for a in actions:
        p_badge = priority_map.get(a.get("priority", "high"), a.get("priority", "high"))
        md_lines.append(f"| {p_badge} | **{a['owner']}** | {a['action']} | `{a['timeline']}` |")

    md_lines.extend([
        "\n---",
        "*本決策報告由 LiveEngage v2 AI 決策引擎依據即時群眾數據自動生成，供管理階層與核心團隊參考落實。*",
    ])

    return {
        "session_id": session_id,
        "session_title": session_title,
        "generated_at": now_str,
        "executive_summary": summary,
        "engagement_rating": engagement_rating,
        "key_metrics": {
            "participant_count": participant_count,
            "participants_engaged": participants_engaged,
            "engaged_percent": engaged_percent,
            "poll_votes_total": poll_votes_total,
            "qa_questions_total": qa_total,
            "answered_count": answered_cnt,
        },
        "key_consensuses": consensuses,
        "divergences": divergences,
        "unanswered_concerns": unanswered_list,
        "action_recommendations": actions,
        "markdown_content": "\n".join(md_lines),
    }


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
    try:
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
    except Exception:
        # 旁路日誌記錄防禦：即使 log 寫入有偶發衝突或異常，不影響主業務流程
        pass


def generate_polls_local(
    topic: str,
    count: int = 3,
    poll_type: str | None = None,
    context: str | None = None,
) -> list[dict[str, Any]]:
    """離線/降級智慧產生題目（確保在無 API Key 時展示 100% 穩定且極具專業水準）。"""
    t = topic.strip().lower()

    is_ice = any(k in t for k in ["破冰", "暖場", "趣味", "輕鬆", "相見歡", "團建", "team building", "開場"])
    is_tech = any(k in t for k in ["架構", "技術", "重構", "系統", "程式", "後端", "前端", "devops", "api", "資料庫", "效能", "microservice", "cloud", "ci/cd", "測試", "ai", "模型"])
    is_prod = any(k in t for k in ["產品", "路線圖", "roadmap", "功能", "使用者", "市場", "客戶", "體驗", "ux", "ui", "成長", "商業", "定價", "運營"])
    is_agile = any(k in t for k in ["敏捷", "agile", "sprint", "復盤", "回顧", "retro", "站會", "時程", "交期"])
    is_edu = any(k in t for k in ["培訓", "教學", "課程", "測驗", "考試", "學習", "工作坊", "workshop", "教育"])

    if is_ice:
        pool = [
            {
                "title": "今天開會/參加活動，你目前的電量指數處於哪種模式？",
                "type": "multiple_choice",
                "options": ["🔋 充飽電 100%，能量爆棚！", "☕ 剛喝完咖啡，思維漸入佳境", "⚡ 電量 30%，隨時需要外援", "🧘 靈魂出竅中，期待精彩分享"],
                "rationality": "趣味破冰，放鬆氣氛並確認現場注意力分佈。",
            },
            {
                "title": f"如果用一個關鍵字代表你對今日「{topic}」的最大期待？",
                "type": "word_cloud",
                "options": [],
                "rationality": "即時匯聚全體期待，建立強烈參與感與大螢幕視覺衝擊。",
            },
            {
                "title": "如果可以擁有一種超能力來完成今天的所有挑戰，你最想要？",
                "type": "multiple_choice",
                "options": ["時光倒流：隨時可 Undo 任何手滑錯誤", "心靈感應：秒懂老闆和用戶在想什麼", "瞬間移動：隨時切換工作與渡假勝地", "影分身術：一個人同時開三場視訊會議"],
                "rationality": "激發想像力與幽默感，拉近與會者距離。",
            },
            {
                "title": "你今天對整體活動的期待程度評分？",
                "type": "rating",
                "options": [],
                "rationality": "建立活動初期熱度基準點。",
            },
        ]
    elif is_tech:
        pool = [
            {
                "title": f"針對「{topic}」，當前架構面臨最迫切的重構瓶頸是？",
                "type": "multiple_choice",
                "options": ["核心 API 吞吐量與高並發回應延遲", "資料庫連線池與長事務讀寫瓶頸", "前端首頁載入資源與打包體積", "自動化測試覆蓋率與 CI/CD 穩定度"],
                "rationality": "快速鎖定團隊技術債與重構優先級，凝聚工程架構共識。",
            },
            {
                "title": f"請以一個關鍵詞分享你在「{topic}」中最關注的技術工具或模式？",
                "type": "word_cloud",
                "options": [],
                "rationality": "藉由文字雲快速蒐集全場熱門關鍵字，視覺化展現技術同義詞聚合。",
            },
            {
                "title": f"你對目前系統針對「{topic}」的監控告警與容錯韌性評分？",
                "type": "rating",
                "options": [],
                "rationality": "量化檢驗團隊對系統生產環境可用性的信心度。",
            },
            {
                "title": "未來半年內，技術團隊在 AI 輔助開發（如 Coding Agent / Copilot）的推進策略？",
                "type": "multiple_choice",
                "options": ["全面納入日常開發並訂定 Code Review 標準", "特定小組進行 PoC 驗證與效能評估", "關注資料隱私與授權合規，審慎評估", "暫無具體規劃，維持現有模式"],
                "rationality": "評估技術組織在智慧化開發工具上的接納成熟度與政策方向。",
            },
        ]
    elif is_prod:
        pool = [
            {
                "title": f"圍繞「{topic}」，下階段最能為用戶創造核心價值的方向是？",
                "type": "multiple_choice",
                "options": ["端到端操作流程簡化與直覺化", "導入 AI 自動化與智慧推薦能力", "企業級協作權限與審計日誌健全", "開放 API 生態與外部服務串接整合"],
                "rationality": "協助產品團隊驗證利害關係人對 Feature 價值的優先排序。",
            },
            {
                "title": f"如果要用一個詞定義「{topic}」的產品核心競爭優勢，你會選？",
                "type": "word_cloud",
                "options": [],
                "rationality": "精煉產品價值主張 (Value Proposition)，對齊品牌心智定位。",
            },
            {
                "title": f"你對即將發布的「{topic}」新功能市場接受度評分？",
                "type": "rating",
                "options": [],
                "rationality": "量化跨職能團隊（業務、行銷、產品、技術）的信心指數。",
            },
            {
                "title": "目前用戶在使用過程中最常遭遇的摩擦點或流失原因？",
                "type": "multiple_choice",
                "options": ["初次新手引導 (Onboarding) 門檻偏高", "關鍵操作缺少即時狀態反饋", "跨裝置或不同螢幕相容體驗不佳", "進階功能隱藏過深難以發現"],
                "rationality": "挖掘用戶體驗痛點，鎖定 Sprint 優化標的。",
            },
        ]
    elif is_agile:
        pool = [
            {
                "title": f"在本次「{topic}」執行中，阻礙團隊流暢交付的最大痛點是？",
                "type": "multiple_choice",
                "options": ["需求規格不明確或中途變更頻繁", "跨團隊/外部依賴項卡件等待", "技術債與測試環境偶發異常", "估時偏樂觀導致最後衝刺壓力過大"],
                "rationality": "直擊敏捷流程阻塞點，提供後續行動清單實質依據。",
            },
            {
                "title": "用一個詞形容你過去這個衝刺週期 (Sprint) 的工作節奏與感受？",
                "type": "word_cloud",
                "options": [],
                "rationality": "透過文字雲建立心理安全感，讓團隊成員自由釋放真實心聲。",
            },
            {
                "title": "本週期團隊內部的溝通透明度與互助協作評分？",
                "type": "rating",
                "options": [],
                "rationality": "檢驗團隊凝聚力與心理安全感指數。",
            },
            {
                "title": "下個週期我們最應該立即嘗試落實的一項改進方針？",
                "type": "multiple_choice",
                "options": ["更嚴格遵守 Definition of Ready (DoR)", "精簡站立會議時長，聚焦阻塞項解決", "預留 20% 固定容量處理重構與測試", "落實敏捷配對驗收與知識傳承"],
                "rationality": "將反思具體收斂為可執行的流程優化項目。",
            },
        ]
    elif is_edu:
        pool = [
            {
                "title": f"關於「{topic}」，下列何者為實務落地時最關鍵的核心原則？",
                "type": "multiple_choice",
                "options": ["以價值與用戶反饋為驅動的持續迭代", "前期單次規劃完畢且不允許任何調整", "忽視邊界條件優先追求最快上線", "完全交由單一角色負責無須跨組共識"],
                "rationality": "檢驗學習者對核心原則之掌握與判斷能力。",
            },
            {
                "title": "請寫下剛剛內容中讓你印象最深刻或啟發最大的觀念？",
                "type": "word_cloud",
                "options": [],
                "rationality": "加深學習記憶，萃取全場學習共鳴亮點。",
            },
            {
                "title": "你對剛剛課程講授內容的清晰度與吸收程度評分？",
                "type": "rating",
                "options": [],
                "rationality": "為講師提供即時教學反饋與步調微調依據。",
            },
        ]
    else:
        pool = [
            {
                "title": f"針對今日主題「{topic}」，你最關注或最期待推進的面向是？",
                "type": "multiple_choice",
                "options": ["具體執行路徑與短中長期里程碑規劃", "跨部門資源調度與權責分工對齊", "潛在風險識別與替代應變方案", "成效量化指標 (KPI/OKR) 與驗收標準"],
                "rationality": "確立與會成員對會議主軸的關注重心，引導後續焦點討論。",
            },
            {
                "title": f"請用一個詞分享你對「{topic}」的直覺印象或想法？",
                "type": "word_cloud",
                "options": [],
                "rationality": "無門檻自由發想，在大螢幕呈現多元觀點交會。",
            },
            {
                "title": f"針對「{topic}」在團隊內部的推進可行性，你目前的信心評分？",
                "type": "rating",
                "options": [],
                "rationality": "量化團隊共識基底，作為決策前的情緒儀表板。",
            },
            {
                "title": "會議結束後，團隊應該最優先採取的第一步行動是？",
                "type": "multiple_choice",
                "options": ["召集核心專案小組細化工作包與排程", "發布正式會議決策紀要並同步全體", "先由小規模團隊執行概念性試點 (PoC)", "重新盤點外部資源後再行決議"],
                "rationality": "推進會議成果落地，明確第一責任與行動時程。",
            },
        ]

    # 若指定了特定 poll_type
    target_type = poll_type if (poll_type and poll_type != "mixed") else None
    if target_type:
        filtered = [p for p in pool if p["type"] == target_type]
        if filtered:
            pool = filtered
        else:
            pool = []

    selected_polls = pool[:count]
    while len(selected_polls) < count:
        idx = len(selected_polls) + 1
        p_type = target_type or "multiple_choice"
        if p_type == "word_cloud":
            selected_polls.append({
                "title": f"請用一個詞分享你對「{topic}」的深度洞察 #{idx}？",
                "type": "word_cloud",
                "options": [],
                "rationality": "廣納多樣詞彙，透過文字雲語意分群發掘隱性共識。",
            })
        elif p_type == "rating":
            selected_polls.append({
                "title": f"針對「{topic}」的推展成效或信心指數，你給予幾分？ #{idx}",
                "type": "rating",
                "options": [],
                "rationality": "量化指標反饋，掌握團隊對此主題的認同程度。",
            })
        elif p_type == "open_text":
            selected_polls.append({
                "title": f"關於「{topic}」，你認為有哪點最值得團隊進一步深究？ #{idx}",
                "type": "open_text",
                "options": [],
                "rationality": "鼓勵質化建議回饋，補充量化數據外的深度觀點。",
            })
        else:
            selected_polls.append({
                "title": f"「{topic}」延伸思考議題 #{idx}",
                "type": "multiple_choice",
                "options": ["選項 A：積極推進並擴大範圍", "選項 B：穩健試點並按步驗證", "選項 C：保留現狀並密切觀察", "選項 D：重新評估並調整架構"],
                "rationality": "引導團隊進行多維度決策衡量。",
            })

    return selected_polls


def dedup_questions_local(questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """離線/降級 Q&A 語意去重與同義題合併（AI-002）。

    支援中英文同義詞概念歸一（簡報/投影片/ppt、錄影/重播/回放、程式碼/repo/github、費用/定價、高並發/效能等）
    以及 Jaccard 字元重合度計算與票數聚合。
    """
    if len(questions) < 2:
        return []

    import uuid

    SYNONYM_DOMAINS = [
        {
            "tag": "slides",
            "keywords": ["簡報", "投影片", "講義", "ppt", "slide", "slides", "課件", "教材"],
            "reason": "均在詢問演講簡報或投影片檔案的會後公開下載方式",
        },
        {
            "tag": "recording",
            "keywords": ["錄影", "錄音", "重播", "回放", "回看", "錄像", "video", "recording", "影音"],
            "reason": "均在詢問活動全程錄影與會後回放觀看連結",
        },
        {
            "tag": "code",
            "keywords": ["原始碼", "代碼", "程式碼", "github", "repo", "專案網址", "開源", "open source"],
            "reason": "均在詢問範例專案原始碼、GitHub 儲存庫或實作細節連結",
        },
        {
            "tag": "pricing",
            "keywords": ["費用", "收費", "免費", "價錢", "價格", "方案", "定價", "pricing", "cost", "付費", "計費"],
            "reason": "均在關注商業產品方案、定價模式與計費收費方式",
        },
        {
            "tag": "performance",
            "keywords": ["高並發", "吞吐量", "延遲", "效能", "瓶頸", "latency", "performance", "qps", "連線池", "超載"],
            "reason": "均在探討系統高並發架構承載力、延遲瓶頸與效能調優方針",
        },
        {
            "tag": "ai_agent",
            "keywords": ["coding agent", "copilot", "ai 工具", "模型", "llm", "ai 輔助", "agent"],
            "reason": "均在關注 AI 輔助開發工具在工程團隊的導入與效益衡量",
        },
        {
            "tag": "security",
            "keywords": ["資安", "資安風險", "隱私", "授權", "安全", "合規", "token", "洩漏", "security"],
            "reason": "均在評估系統資安合規、資料隱私防護與授權管控架構",
        },
    ]

    noise_words = [
        "請問", "請問一下", "想請問", "不知", "是否有", "會不會", "能否", "可以", "會", "嗎",
        "的", "了", "呢", "一下", "大家", "老師", "講者", "您好", "請教", "我想問", "甚麼", "什麼",
        "在哪", "哪裡", "如何", "怎麼", "提供", "公開", "下載", "分享", "索取", "取得", "獲得"
    ]

    def _normalize(text: str) -> tuple[str, set[str], set[str]]:
        t = text.strip().lower()
        matched_tags = set()
        for dom in SYNONYM_DOMAINS:
            if any(kw in t for kw in dom["keywords"]):
                matched_tags.add(dom["tag"])

        clean = t
        for nw in noise_words:
            clean = clean.replace(nw, "")
        clean_chars = {c for c in clean if c.isalnum()}
        return clean, clean_chars, matched_tags

    normalized = [_normalize(q.get("content", "")) for q in questions]

    n = len(questions)
    # 建立相似度圖（Adjacency Graph）
    adj: dict[int, set[int]] = {i: set() for i in range(n)}

    for i in range(n):
        c_i, chars_i, tags_i = normalized[i]
        for j in range(i + 1, n):
            c_j, chars_j, tags_j = normalized[j]

            # 情況 1：命中相同特定領域同義標籤（例如 slides、recording、code 等）
            common_tags = tags_i & tags_j
            if common_tags:
                adj[i].add(j)
                adj[j].add(i)
                continue

            # 情況 2：字元 Jaccard 相似度高（排除過短問題）
            if chars_i and chars_j:
                union = chars_i | chars_j
                inter = chars_i & chars_j
                jaccard = len(inter) / len(union) if union else 0
                if jaccard >= 0.45 and len(inter) >= 3:
                    adj[i].add(j)
                    adj[j].add(i)

    # 連通分量分群 (Connected Components)
    visited = set()
    clusters: list[dict[str, Any]] = []

    for i in range(n):
        if i in visited:
            continue
        group_indices: list[int] = []
        queue = [i]
        visited.add(i)
        while queue:
            curr = queue.pop(0)
            group_indices.append(curr)
            for neighbor in adj[curr]:
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)

        if len(group_indices) < 2:
            continue

        # 抽出同群題目
        group_questions = [questions[idx] for idx in group_indices]

        # 排序決定主提問：優先以 upvote_count 最高，同票數以長度最完整者為首
        group_questions.sort(
            key=lambda q: (
                q.get("upvote_count", 0),
                len(q.get("content", "")),
            ),
            reverse=True,
        )

        primary_q = group_questions[0]
        duplicate_qs = group_questions[1:]
        combined_upvotes = sum(q.get("upvote_count", 0) for q in group_questions)

        # 決定聚合原因說明
        common_tags = set()
        for idx in group_indices:
            common_tags.update(normalized[idx][2])

        reason = ""
        for dom in SYNONYM_DOMAINS:
            if dom["tag"] in common_tags:
                reason = dom["reason"]
                break
        if not reason:
            reason = f"均在討論「{primary_q.get('content', '')[:18]}...」相關核心議題，語意高度重複"

        cluster_id = f"cluster-{uuid.uuid4().hex[:8]}"
        clusters.append({
            "cluster_id": cluster_id,
            "primary_question": primary_q,
            "duplicate_questions": duplicate_qs,
            "combined_upvotes": combined_upvotes,
            "similarity_reason": reason,
        })

    # 依總票數高低排序 clusters
    clusters.sort(key=lambda c: c["combined_upvotes"], reverse=True)
    return clusters


async def _stub_llm_call(feature: AiFeature, payload: dict[str, Any]) -> dict[str, Any]:
    """Placeholder：模擬外部 LLM 延遲或執行離線規則分群。"""

    async def _inner() -> dict[str, Any]:
        await asyncio.sleep(0.05)
        if feature == AiFeature.CLUSTER_WORDS:
            return {"clusters": cluster_words_local(payload.get("words", []))}
        if feature == AiFeature.GENERATE_POLLS:
            return {
                "polls": generate_polls_local(
                    topic=payload.get("topic", ""),
                    count=int(payload.get("count", 3)),
                    poll_type=payload.get("poll_type"),
                    context=payload.get("context"),
                )
            }
        if feature == AiFeature.REWRITE:
            return {"text": f"（AI stub）{payload.get('text', '')}"}
        if feature == AiFeature.QUESTION_ASSIST:
            return {
                "suggestions": [
                    f"（AI stub）延伸：{payload.get('question', '')}",
                ]
            }
        if feature == AiFeature.GENERATE_REPORT:
            return generate_decision_report_local(payload.get("data", {}))
        if feature == AiFeature.DEDUP_QUESTIONS:
            return {"clusters": dedup_questions_local(payload.get("questions", []))}
        return {"message": "stub"}

    return await _run_with_timeout(_inner())


def _resolve_ai_config(ai_override: AiConfigOverride | None = None) -> tuple[str, str, str, str]:
    """解析 (api_key, provider, model, base_url)，優先使用 override，次之使用 settings。"""
    settings = get_settings()
    api_key = (ai_override.api_key if ai_override and ai_override.api_key else settings.ai_api_key).strip()
    provider = (ai_override.provider if ai_override and ai_override.provider else settings.ai_provider).lower().strip()
    base_url = (ai_override.base_url if ai_override and ai_override.base_url else settings.ai_base_url).strip()
    model = (ai_override.model if ai_override and ai_override.model else settings.ai_model).strip()

    if provider == "auto":
        if api_key.startswith("sk-or-") or "openrouter.ai" in base_url:
            provider = "openrouter"
        elif api_key.startswith("AIza") or "googleapis.com" in base_url:
            provider = "gemini"
        else:
            provider = "openai"

    if provider == "openrouter":
        if not base_url or base_url == "https://api.openai.com/v1":
            base_url = "https://openrouter.ai/api/v1"
        if not model or model == "gpt-4o-mini":
            model = "google/gemini-2.5-flash"
    elif provider == "gemini":
        if not base_url or base_url == "https://api.openai.com/v1":
            base_url = "https://generativelanguage.googleapis.com/v1beta/openai"
        if not model or model == "gpt-4o-mini":
            model = "gemini-2.5-flash"
    elif provider == "openai":
        if not base_url:
            base_url = "https://api.openai.com/v1"
        if not model:
            model = "gpt-4o-mini"

    return api_key, provider, model, base_url


async def fetch_ai_models(
    ai_override: AiConfigOverride | None = None,
) -> dict[str, Any]:
    """獲取指定 Provider 的可用文字模型清單，並過濾排除純生圖、音訊、Embedding 等不適用模型。"""
    import httpx

    api_key, provider, _, base_url = _resolve_ai_config(ai_override)
    models: list[dict[str, Any]] = []

    # 1. OpenRouter
    if provider == "openrouter" or "openrouter.ai" in base_url:
        target_url = "https://openrouter.ai/api/v1/models"
        headers: dict[str, str] = {"User-Agent": "LiveEngage v2"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
            headers["HTTP-Referer"] = "https://liveengage.pages.dev"
            headers["X-Title"] = "LiveEngage v2"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(target_url, headers=headers)
                if not resp.is_success:
                    return {
                        "status": "error",
                        "message": f"無法獲取 OpenRouter 模型列表 (HTTP {resp.status_code}): {resp.text[:120]}",
                        "provider": provider,
                        "models": [],
                    }
                data = resp.json().get("data", [])
                for m in data:
                    mid = m.get("id", "")
                    arch = m.get("architecture") or {}
                    out_mods = arch.get("output_modalities") or ["text"]
                    if "text" not in out_mods:
                        continue
                    if ":batch" in mid:
                        continue
                    mid_lower = mid.lower()
                    if any(x in mid_lower for x in ["embedding", "moderation", "guard", "whisper", "dall-e", "stable-diffusion", "flux"]):
                        continue
                    if mid_lower.endswith(("-image", "-image-preview")):
                        continue
                    models.append({
                        "id": mid,
                        "name": m.get("name") or mid,
                        "description": m.get("description"),
                        "context_length": m.get("context_length"),
                        "is_free": mid.endswith(":free"),
                    })
        except Exception as e:
            return {
                "status": "error",
                "message": f"連線 OpenRouter 失敗 ({type(e).__name__}): {str(e)[:120]}",
                "provider": provider,
                "models": [],
            }

    # 2. Google Gemini
    elif provider == "gemini" or "generativelanguage.googleapis.com" in base_url:
        if not api_key:
            return {
                "status": "warning",
                "message": "請先填寫 Google Gemini API Key 以獲取最新模型清單。",
                "provider": provider,
                "models": [],
            }
        target_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(target_url)
                if not resp.is_success:
                    return {
                        "status": "error",
                        "message": f"無法獲取 Gemini 模型列表 (HTTP {resp.status_code}): {resp.text[:120]}",
                        "provider": provider,
                        "models": [],
                    }
                gemini_models = resp.json().get("models", [])
                for gm in gemini_models:
                    methods = gm.get("supportedGenerationMethods", [])
                    if "generateContent" not in methods:
                        continue
                    raw_name = gm.get("name", "")
                    model_id = raw_name.replace("models/", "")
                    models.append({
                        "id": model_id,
                        "name": gm.get("displayName") or model_id,
                        "description": gm.get("description"),
                        "context_length": gm.get("inputTokenLimit"),
                        "is_free": False,
                    })
        except Exception as e:
            return {
                "status": "error",
                "message": f"連線 Gemini 失敗 ({type(e).__name__}): {str(e)[:120]}",
                "provider": provider,
                "models": [],
            }

    # 3. OpenAI or Custom
    else:
        target_url = f"{base_url.rstrip('/')}/models"
        headers = {}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(target_url, headers=headers)
                if not resp.is_success:
                    return {
                        "status": "error",
                        "message": f"無法獲取模型列表 (HTTP {resp.status_code}): {resp.text[:120]}",
                        "provider": provider,
                        "models": [],
                    }
                data = resp.json().get("data", [])
                for m in data:
                    mid = m.get("id", "")
                    mid_lower = mid.lower()
                    if any(x in mid_lower for x in ["embedding", "dall-e", "tts", "whisper", "moderation", "realtime", "audio", "rerank"]):
                        continue
                    models.append({
                        "id": mid,
                        "name": mid,
                        "description": None,
                        "context_length": None,
                        "is_free": False,
                    })
        except Exception as e:
            return {
                "status": "error",
                "message": f"連線失敗 ({type(e).__name__}): {str(e)[:120]}",
                "provider": provider,
                "models": [],
            }

    def sort_key(m: dict[str, Any]) -> tuple[int, int, str]:
        free_rank = 0 if m.get("is_free") else 1
        mid = m.get("id", "").lower()
        provider_rank = 2
        if any(p in mid for p in ["gemini-2.5", "gemini-3", "gpt-4o", "claude-3.5", "deepseek"]):
            provider_rank = 0
        elif any(p in mid for p in ["google/", "openai/", "anthropic/", "deepseek/"]):
            provider_rank = 1
        return (free_rank, provider_rank, m.get("name", "").lower())

    models.sort(key=sort_key)

    return {
        "status": "ok",
        "message": f"成功載入 {len(models)} 個可用文字處理模型",
        "provider": provider,
        "models": models,
    }


async def test_ai_connection(
    ai_override: AiConfigOverride | None = None,
) -> dict[str, Any]:
    """驗證 LLM 連線與 API Key 有效性，並載入最新可用文字模型清單。"""
    import time
    import httpx

    api_key, provider, model, base_url = _resolve_ai_config(ai_override)
    if not api_key:
        return {
            "status": "warning",
            "message": "未設定 API Key，系統目前使用離線雙軌降級模式（無須 Key 即可正常操作）。",
            "provider": provider,
            "model": model,
            "latency_ms": 0,
            "models": [],
        }

    started = time.perf_counter()

    # 1. 先嘗試獲取模型清單（同時能檢驗 API Key 是否有效）
    models_res = await fetch_ai_models(ai_override)
    models = models_res.get("models", [])

    # 如果模型清單請求直接報 401/403，代表 API Key 無效
    if models_res.get("status") == "error" and any(code in models_res.get("message", "") for code in ["401", "403"]):
        latency_ms = int((time.perf_counter() - started) * 1000)
        return {
            "status": "error",
            "message": f"API Key 驗證失敗：{models_res.get('message')}",
            "provider": provider,
            "model": model,
            "latency_ms": latency_ms,
            "models": [],
        }

    # 2. 若使用者未填寫模型名稱
    if not model:
        latency_ms = int((time.perf_counter() - started) * 1000)
        return {
            "status": "ok",
            "message": f"API Key 驗證成功！已成功載入 {len(models)} 個可用模型，請由下方選單挑選。",
            "provider": provider,
            "model": model,
            "latency_ms": latency_ms,
            "models": models,
        }

    # 3. 測試呼叫該模型 chat/completions
    headers: dict[str, str] = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if provider == "openrouter" or "openrouter.ai" in base_url:
        headers["HTTP-Referer"] = "https://liveengage.pages.dev"
        headers["X-Title"] = "LiveEngage v2"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                f"{base_url.rstrip('/')}/chat/completions",
                headers=headers,
                json={
                    "model": model,
                    "messages": [
                        {"role": "user", "content": "Ping. Reply with JSON: {\"ok\": true}"}
                    ],
                    "max_tokens": 15,
                },
            )
            latency_ms = int((time.perf_counter() - started) * 1000)
            if resp.is_success:
                return {
                    "status": "ok",
                    "message": f"連線成功！LLM 模型 [{model}] 回應正常（耗時 {latency_ms}ms）。已載入 {len(models)} 個可用模型。",
                    "provider": provider,
                    "model": model,
                    "latency_ms": latency_ms,
                    "models": models,
                }
            else:
                body_snippet = resp.text[:140].replace("\n", " ")
                # 若為 404 或模型不存在，但 API Key 是有效的（已取到模型清單）
                if resp.status_code in (404, 400) and len(models) > 0:
                    return {
                        "status": "warning",
                        "message": f"API Key 有效，但原模型 [{model}] 目前無法使用 (HTTP {resp.status_code})。已為您獲取 {len(models)} 個最新可用模型，請由下方選單挑選！",
                        "provider": provider,
                        "model": model,
                        "latency_ms": latency_ms,
                        "models": models,
                    }
                return {
                    "status": "error",
                    "message": f"API 回應錯誤 (HTTP {resp.status_code}): {body_snippet}",
                    "provider": provider,
                    "model": model,
                    "latency_ms": latency_ms,
                    "models": models,
                }
    except Exception as exc:
        latency_ms = int((time.perf_counter() - started) * 1000)
        return {
            "status": "error",
            "message": f"連線異常 ({type(exc).__name__}): {str(exc)[:120]}",
            "provider": provider,
            "model": model,
            "latency_ms": latency_ms,
            "models": models,
        }


async def _real_llm_call(
    feature: AiFeature,
    payload: dict[str, Any],
    *,
    ai_override: AiConfigOverride | None = None,
) -> dict[str, Any]:
    """支援 OpenAI / OpenRouter / Gemini / 任意相容 API 的 Chat Completions。"""
    import json
    import httpx

    api_key, provider, model, base_url = _resolve_ai_config(ai_override)
    if feature == AiFeature.GENERATE_POLLS:
        topic = payload.get("topic", "")
        count = int(payload.get("count", 3))
        poll_type = payload.get("poll_type", "mixed")
        context = payload.get("context", "")
        type_instruction = (
            f"All questions must be of type '{poll_type}'."
            if poll_type and poll_type != "mixed"
            else "Provide a balanced, engaging mix of types: multiple_choice (with 3-5 options), word_cloud (options should be []), and rating (options should be [])."
        )
        prompt = (
            f"You are an expert audience engagement designer and conference facilitator.\n"
            f"Generate {count} live interactive poll questions for an audience on the topic: 「{topic}」.\n"
            f"Context: {context if context else 'General team/enterprise event'}\n"
            f"{type_instruction}\n\n"
            "Requirements:\n"
            "1. Output language must be Traditional Chinese (繁體中文).\n"
            "2. Questions must be crisp, thought-provoking, and practical.\n"
            "3. For 'multiple_choice', provide 3 to 5 realistic, distinctive option texts in 'options'.\n"
            "4. For 'word_cloud', set 'options': [] and make the question invite a single word response.\n"
            "5. For 'rating', set 'options': [] and make the question invite 1-5 star rating.\n"
            "6. For 'open_text', set 'options': [].\n"
            "7. Include a concise 'rationality' explaining why this poll works well.\n"
            "Return JSON strictly adhering to this format:\n"
            '{"polls": [{"title": "題目", "type": "multiple_choice", "description": "", "options": ["選項1", "選項2", "選項3"], "settings": {}, "rationality": "..."}]}'
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
    elif feature == AiFeature.GENERATE_REPORT:
        data_json = json.dumps(payload.get("data", {}), ensure_ascii=False)
        prompt = (
            "You are an elite executive strategy consultant (McKinsey/BCG caliber) advising leadership. "
            "Analyze the audience engagement, poll responses, Q&A interactions, and ideas from the event session below:\n"
            f"{data_json}\n\n"
            "Task: Formulate an incisive, actionable Executive Decision Report in Traditional Chinese (繁體中文). "
            "Requirements:\n"
            "1. executive_summary: A punchy 2-3 paragraph synthesis of attendee sentiment, strategic mandates confirmed, and key decisions.\n"
            "2. engagement_rating: A short evaluation score (e.g. '卓越 (參與率 85%) - 全員深度共創', '良好', etc.).\n"
            "3. key_metrics: Dict containing participants, engaged_pct, total_votes, qa_count, answered_count.\n"
            "4. key_consensuses: List of objects with {title, evidence, impact} highlighting strong alignments.\n"
            "5. divergences: List of objects with {topic, description, suggested_compromise} where opinions clashed or split.\n"
            "6. unanswered_concerns: List of objects with {question, upvotes, why_important, suggested_response_direction} for top voted unanswered questions.\n"
            "7. action_recommendations: List of 3-5 concrete tasks with {owner, action, priority, timeline} where priority is 'high', 'medium', or 'low'.\n"
            "8. markdown_content: A complete, beautifully formatted Markdown report with titles, tables, bullet points, and key takeaways.\n"
            "Return strictly valid JSON adhering to this structure."
        )
    elif feature == AiFeature.DEDUP_QUESTIONS:
        questions_input = payload.get("questions", [])
        prompt = (
            "You are an expert Q&A facilitator in live conferences and webinars. "
            "Analyze the following list of audience questions, identify semantic duplicates or questions asking the exact same core intent with different wording, "
            "and group them into deduplication clusters.\n\n"
            f"Questions list (JSON):\n{json.dumps(questions_input, ensure_ascii=False)}\n\n"
            "Requirements:\n"
            "1. Group questions that share the exact same user intent (e.g. asking for slides/presentation files, recording/playback, repo/source code, pricing/plans, or system performance bottlenecks).\n"
            "2. Each cluster must have at least 2 questions (1 primary_question and 1+ duplicate_questions).\n"
            "3. Choose the best primary question (highest upvotes or most articulate wording).\n"
            "4. Provide a clear similarity_reason in Traditional Chinese (繁體中文, e.g. '均在詢問演講簡報或投影片檔案的會後公開下載方式').\n"
            "5. Calculate combined_upvotes = sum of upvote_count of all questions in the cluster.\n"
            "Output strictly valid JSON with this format:\n"
            "{\n"
            '  "clusters": [\n'
            '    {\n'
            '      "cluster_id": "cluster-1",\n'
            '      "primary_question_id": "...",\n'
            '      "duplicate_question_ids": ["..."],\n'
            '      "similarity_reason": "...",\n'
            '      "combined_upvotes": 20\n'
            '    }\n'
            '  ]\n'
            "}\n"
            "If no duplicate questions exist, return {\"clusters\": []}."
        )
    else:
        prompt = (
            f"Suggest follow-up questions for: {payload.get('question', '')}. "
            f"Context: {payload.get('context', '')}. "
            'Return JSON: {"suggestions":["..."]}'
        )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if provider == "openrouter" or "openrouter.ai" in base_url:
        headers["HTTP-Referer"] = "https://liveengage.pages.dev"
        headers["X-Title"] = "LiveEngage v2"

    async with httpx.AsyncClient(timeout=9.0) as client:
        resp = await client.post(
            f"{base_url.rstrip('/')}/chat/completions",
            headers=headers,
            json={
                "model": model,
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


async def _llm_call(
    feature: AiFeature,
    payload: dict[str, Any],
    *,
    ai_override: AiConfigOverride | None = None,
) -> dict[str, Any]:
    api_key, _, _, _ = _resolve_ai_config(ai_override)
    if api_key:
        try:
            return await _run_with_timeout(_real_llm_call(feature, payload, ai_override=ai_override))
        except Exception:
            pass
    return await _stub_llm_call(feature, payload)


async def generate_polls(
    db: AsyncSession,
    *,
    user: User,
    payload: AiGeneratePollsRequest,
    ai_override: AiConfigOverride | None = None,
) -> AiGeneratePollsResponse:
    """AI-001：依主題智慧產生 Poll 題目草稿（離線降級 + 雙軌保證）。"""
    api_key, _, _, _ = _resolve_ai_config(ai_override)
    if not api_key:
        raise AppError(
            ErrorCode.AI_UNAVAILABLE,
            "AI 服務未設定（缺少 ai_api_key，請至 ⚙️ AI 設定填入 API Key）",
        )

    started = time.perf_counter()
    status = "ok"
    polls_list: list[dict[str, Any]] = []

    try:
        res = await _llm_call(
            AiFeature.GENERATE_POLLS,
            {
                "topic": payload.topic,
                "count": payload.count,
                "context": payload.context,
                "poll_type": payload.poll_type,
            },
            ai_override=ai_override,
        )
        if isinstance(res, dict) and "polls" in res and isinstance(res["polls"], list):
            polls_list = res["polls"]
        else:
            polls_list = generate_polls_local(
                payload.topic,
                payload.count,
                payload.poll_type,
                payload.context,
            )
    except Exception:
        status = "fallback"
        polls_list = generate_polls_local(
            payload.topic,
            payload.count,
            payload.poll_type,
            payload.context,
        )

    typed_polls: list[AiGeneratedPollItem] = []
    for item in polls_list:
        if isinstance(item, dict):
            typed_polls.append(
                AiGeneratedPollItem(
                    title=str(item.get("title", "未命名題目")),
                    type=str(item.get("type", "multiple_choice")),
                    description=str(item.get("description", "")),
                    options=[str(o) for o in item.get("options", []) if str(o).strip()],
                    settings=item.get("settings", {}) if isinstance(item.get("settings"), dict) else {},
                    rationality=str(item.get("rationality", "")),
                )
            )

    latency_ms = int((time.perf_counter() - started) * 1000)
    await _log_request(
        db,
        user=user,
        feature=AiFeature.GENERATE_POLLS,
        status=status,
        latency_ms=latency_ms,
        details={"topic": payload.topic, "count": len(typed_polls)},
    )
    return AiGeneratePollsResponse(
        polls=typed_polls,
        result={"polls": [p.model_dump() for p in typed_polls]},
        latency_ms=latency_ms,
    )


async def dedup_questions(
    db: AsyncSession,
    *,
    user: User,
    questions: list[dict[str, Any]],
    ai_override: AiConfigOverride | None = None,
) -> AiDedupQuestionsResponse:
    """AI-002：Q&A 語意去重與同義題分群（雙軌保證，離線降級支援）。"""
    started = time.perf_counter()
    status = "ok"
    clusters_data: list[dict[str, Any]] = []

    try:
        if len(questions) < 2:
            return AiDedupQuestionsResponse(
                clusters=[],
                total_duplicates_found=0,
                is_ai_generated=True,
                latency_ms=0,
            )

        res = await _llm_call(
            AiFeature.DEDUP_QUESTIONS,
            {"questions": questions},
            ai_override=ai_override,
        )
        if isinstance(res, dict) and "clusters" in res and isinstance(res["clusters"], list):
            raw_clusters = res["clusters"]
            q_map = {str(q.get("id")): q for q in questions}
            for rc in raw_clusters:
                if "primary_question" in rc and isinstance(rc["primary_question"], dict):
                    clusters_data.append(rc)
                elif "primary_question_id" in rc:
                    p_id = str(rc["primary_question_id"])
                    d_ids = [str(did) for did in rc.get("duplicate_question_ids", [])]
                    if p_id in q_map and d_ids:
                        primary_q = q_map[p_id]
                        dups = [q_map[did] for did in d_ids if did in q_map]
                        if dups:
                            clusters_data.append({
                                "cluster_id": rc.get("cluster_id", f"cluster-{uuid.uuid4().hex[:8]}"),
                                "primary_question": primary_q,
                                "duplicate_questions": dups,
                                "combined_upvotes": int(
                                    rc.get(
                                        "combined_upvotes",
                                        primary_q.get("upvote_count", 0) + sum(d.get("upvote_count", 0) for d in dups),
                                    )
                                ),
                                "similarity_reason": rc.get("similarity_reason", "同義提問意圖聚合"),
                            })
        if not clusters_data:
            clusters_data = dedup_questions_local(questions)
    except Exception:
        status = "fallback"
        clusters_data = dedup_questions_local(questions)

    latency_ms = int((time.perf_counter() - started) * 1000)
    await _log_request(
        db,
        user=user,
        feature=AiFeature.DEDUP_QUESTIONS,
        status=status,
        latency_ms=latency_ms,
        details={
            "total_questions": len(questions),
            "clusters_found": len(clusters_data),
        },
    )

    cluster_items: list[AiQuestionCluster] = []
    total_dups = 0
    import uuid

    for c in clusters_data:
        p_q = c["primary_question"]
        dups = c["duplicate_questions"]
        total_dups += len(dups)
        cluster_items.append(
            AiQuestionCluster(
                cluster_id=str(c.get("cluster_id", uuid.uuid4().hex[:8])),
                primary_question=AiQuestionItem(
                    id=str(p_q.get("id")),
                    content=str(p_q.get("content", "")),
                    author_display=p_q.get("author_display"),
                    is_anonymous=bool(p_q.get("is_anonymous", False)),
                    upvote_count=int(p_q.get("upvote_count", 0)),
                    status=str(p_q.get("status", "approved")),
                    created_at=str(p_q.get("created_at", "")) if p_q.get("created_at") else None,
                ),
                duplicate_questions=[
                    AiQuestionItem(
                        id=str(d.get("id")),
                        content=str(d.get("content", "")),
                        author_display=d.get("author_display"),
                        is_anonymous=bool(d.get("is_anonymous", False)),
                        upvote_count=int(d.get("upvote_count", 0)),
                        status=str(d.get("status", "approved")),
                        created_at=str(d.get("created_at", "")) if d.get("created_at") else None,
                    )
                    for d in dups
                ],
                combined_upvotes=int(c.get("combined_upvotes", 0)),
                similarity_reason=str(c.get("similarity_reason", "")),
            )
        )

    return AiDedupQuestionsResponse(
        clusters=cluster_items,
        total_duplicates_found=total_dups,
        is_ai_generated=True,
        latency_ms=latency_ms,
    )



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
    ai_override: AiConfigOverride | None = None,
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
            ai_override=ai_override,
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


def render_report_html(report: AiDecisionReport) -> str:
    """產出獨立且可列印、高質感的 HTML 格式決策報告。"""
    import html

    title = html.escape(report.session_title)
    gen_at = html.escape(report.generated_at)
    rating = html.escape(report.engagement_rating)
    summary = html.escape(report.executive_summary).replace("\n\n", "</p><p>").replace("\n", "<br/>")

    metrics = report.key_metrics
    p_count = metrics.get("participant_count", 0)
    p_engaged = metrics.get("participants_engaged", 0)
    p_pct = metrics.get("engaged_percent", 0)
    p_votes = metrics.get("poll_votes_total", 0)
    p_qa = metrics.get("qa_questions_total", 0)
    p_ans = metrics.get("answered_count", 0)

    consensuses_html = ""
    for idx, c in enumerate(report.key_consensuses, 1):
        c_title = html.escape(c.title)
        c_ev = html.escape(c.evidence)
        c_imp = html.escape(c.impact)
        consensuses_html += f"""
        <div class="card consensus-card">
            <div class="card-header">
                <span class="badge badge-emerald">共識 #{idx}</span>
                <h4>{c_title}</h4>
            </div>
            <div class="card-body">
                <p><strong>📊 數據佐證：</strong>{c_ev}</p>
                <p><strong>💡 決策意涵：</strong>{c_imp}</p>
            </div>
        </div>
        """

    divergences_html = ""
    for idx, d in enumerate(report.divergences, 1):
        d_topic = html.escape(d.topic)
        d_desc = html.escape(d.description)
        d_comp = html.escape(d.suggested_compromise)
        divergences_html += f"""
        <div class="card divergence-card">
            <div class="card-header">
                <span class="badge badge-amber">分歧 #{idx}</span>
                <h4>{d_topic}</h4>
            </div>
            <div class="card-body">
                <p><strong>⚖️ 議題現況：</strong>{d_desc}</p>
                <div class="compromise-box">
                    <strong>🤝 建議平衡解法：</strong>{d_comp}
                </div>
            </div>
        </div>
        """

    unanswered_html = ""
    if report.unanswered_concerns:
        for idx, u in enumerate(report.unanswered_concerns, 1):
            u_q = html.escape(u.question)
            u_votes = u.upvotes
            u_why = html.escape(u.why_important)
            u_resp = html.escape(u.suggested_response_direction)
            unanswered_html += f"""
            <div class="card unanswered-card">
                <div class="card-header">
                    <span class="badge badge-rose">焦點 #{idx}</span>
                    <h4>{u_q}</h4>
                    <span class="upvote-pill">👍 {u_votes} 票認同</span>
                </div>
                <div class="card-body">
                    <p><strong>❓ 關注焦點：</strong>{u_why}</p>
                    <p><strong>🎯 建議回覆：</strong>{u_resp}</p>
                </div>
            </div>
            """
    else:
        unanswered_html = "<div class='empty-note'>✨ 本場活動提問皆已即時妥善回覆完畢。</div>"

    action_rows = ""
    prio_classes = {"high": "priority-high", "medium": "priority-medium", "low": "priority-low"}
    prio_labels = {"high": "🔴 高 (High)", "medium": "🟡 中 (Medium)", "low": "🟢 低 (Low)"}
    for a in report.action_recommendations:
        a_owner = html.escape(a.owner)
        a_act = html.escape(a.action)
        a_prio = a.priority.lower()
        a_time = html.escape(a.timeline)
        cls = prio_classes.get(a_prio, "priority-medium")
        lbl = prio_labels.get(a_prio, a.priority)
        action_rows += f"""
        <tr>
            <td><span class="badge {cls}">{lbl}</span></td>
            <td><strong>{a_owner}</strong></td>
            <td>{a_act}</td>
            <td><code>{a_time}</code></td>
        </tr>
        """

    md_safe = report.markdown_content.replace("\\", "\\\\").replace("`", "\\`").replace("$", "\\$")

    return f"""<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI 決策報告 - {title}</title>
    <style>
        :root {{
            --primary: #4f46e5;
            --primary-dark: #3730a3;
            --slate-900: #0f172a;
            --slate-800: #1e293b;
            --slate-700: #334155;
            --slate-100: #f1f5f9;
            --slate-50: #f8fafc;
            --emerald-600: #059669;
            --emerald-50: #ecfdf5;
            --amber-600: #d97706;
            --amber-50: #fffbeb;
            --rose-600: #e11d48;
            --rose-50: #fff1f2;
        }}
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang TC", "Noto Sans TC", sans-serif;
            background: #f8fafc;
            color: #1e293b;
            line-height: 1.6;
            padding: 32px 16px;
        }}
        .container {{
            max-width: 960px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03);
            border: 1px solid #e2e8f0;
            padding: 40px 48px;
        }}
        .toolbar {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid #e2e8f0;
        }}
        .btn {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            border: none;
            transition: all 0.15s ease;
        }}
        .btn-primary {{
            background: var(--primary);
            color: white;
        }}
        .btn-primary:hover {{ background: var(--primary-dark); }}
        .btn-secondary {{
            background: #e2e8f0;
            color: #334155;
        }}
        .btn-secondary:hover {{ background: #cbd5e1; }}
        .header {{
            margin-bottom: 32px;
        }}
        .logo-tag {{
            display: inline-block;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            background: #e0e7ff;
            color: #4338ca;
            padding: 4px 10px;
            border-radius: 9999px;
            margin-bottom: 12px;
        }}
        h1 {{
            font-size: 28px;
            font-weight: 800;
            color: var(--slate-900);
            line-height: 1.3;
            margin-bottom: 8px;
        }}
        .meta-info {{
            font-size: 14px;
            color: #64748b;
        }}
        .metrics-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
            margin-bottom: 32px;
        }}
        .metric-card {{
            background: var(--slate-50);
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px 20px;
        }}
        .metric-label {{
            font-size: 13px;
            font-weight: 600;
            color: #64748b;
            margin-bottom: 4px;
        }}
        .metric-val {{
            font-size: 26px;
            font-weight: 800;
            color: var(--slate-900);
        }}
        .metric-sub {{
            font-size: 12px;
            color: #64748b;
            margin-top: 2px;
        }}
        .section-title {{
            font-size: 20px;
            font-weight: 700;
            color: var(--slate-900);
            margin: 36px 0 16px 0;
            display: flex;
            align-items: center;
            gap: 8px;
            border-bottom: 2px solid #f1f5f9;
            padding-bottom: 8px;
        }}
        .summary-box {{
            background: #f8fafc;
            border-left: 4px solid var(--primary);
            border-radius: 0 12px 12px 0;
            padding: 20px 24px;
            font-size: 15px;
            color: #334155;
            line-height: 1.7;
        }}
        .card {{
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 18px 20px;
            margin-bottom: 14px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
            page-break-inside: avoid;
        }}
        .consensus-card {{ border-left: 4px solid var(--emerald-600); }}
        .divergence-card {{ border-left: 4px solid var(--amber-600); }}
        .unanswered-card {{ border-left: 4px solid var(--rose-600); }}
        .card-header {{
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }}
        .card-header h4 {{
            font-size: 16px;
            font-weight: 700;
            color: var(--slate-900);
            flex: 1;
        }}
        .badge {{
            font-size: 11px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
        }}
        .badge-emerald {{ background: var(--emerald-50); color: var(--emerald-600); }}
        .badge-amber {{ background: var(--amber-50); color: var(--amber-600); }}
        .badge-rose {{ background: var(--rose-50); color: var(--rose-600); }}
        .priority-high {{ background: #fee2e2; color: #b91c1c; }}
        .priority-medium {{ background: #fef3c7; color: #b45309; }}
        .priority-low {{ background: #e0e7ff; color: #4338ca; }}
        .upvote-pill {{
            font-size: 12px;
            font-weight: 700;
            background: #ffe4e6;
            color: #e11d48;
            padding: 3px 8px;
            border-radius: 9999px;
        }}
        .compromise-box {{
            margin-top: 10px;
            background: #fffbeb;
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 14px;
            color: #92400e;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
            margin-top: 12px;
        }}
        th, td {{
            padding: 12px 14px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }}
        th {{
            background: #f8fafc;
            color: #475569;
            font-weight: 600;
        }}
        .empty-note {{
            padding: 20px;
            text-align: center;
            background: #f8fafc;
            border-radius: 8px;
            color: #64748b;
            font-size: 14px;
        }}
        footer {{
            margin-top: 48px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 13px;
            color: #94a3b8;
        }}
        @media print {{
            body {{ background: #ffffff; padding: 0; }}
            .container {{ box-shadow: none; border: none; padding: 0; }}
            .no-print {{ display: none !important; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="toolbar no-print">
            <span style="font-weight: 600; font-size: 14px; color: #64748b;">LiveEngage v2 智能決策引擎</span>
            <div style="display: flex; gap: 8px;">
                <button class="btn btn-secondary" onclick="copyMarkdown()">📋 複製 Markdown</button>
                <button class="btn btn-primary" onclick="window.print()">🖨️ 列印 / 另存為 PDF</button>
            </div>
        </div>

        <div class="header">
            <span class="logo-tag">✨ AI Executive Decision Report</span>
            <h1>{title}</h1>
            <div class="meta-info">
                <span>生成時間：{gen_at}</span> ｜ <span>整體參與指數：<strong>{rating}</strong></span>
            </div>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-label">與會總人數</div>
                <div class="metric-val">{p_count}</div>
                <div class="metric-sub">人在線</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">主動參與率</div>
                <div class="metric-val" style="color: var(--primary);">{p_pct}%</div>
                <div class="metric-sub">{p_engaged} 人主動發聲</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">投票與回饋總數</div>
                <div class="metric-val">{p_votes}</div>
                <div class="metric-sub">筆有效票</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Q&A 提問</div>
                <div class="metric-val">{p_qa}</div>
                <div class="metric-sub">已解答 {p_ans} 則</div>
            </div>
        </div>

        <h2 class="section-title">🎯 執行摘要 (Executive Summary)</h2>
        <div class="summary-box">
            <p>{summary}</p>
        </div>

        <h2 class="section-title">💡 關鍵共識分析 (Key Consensuses)</h2>
        {consensuses_html}

        <h2 class="section-title">⚖️ 議題分歧與拉鋸點 (Points of Divergence)</h2>
        {divergences_html}

        <h2 class="section-title">❓ 觀眾高度關注之未解焦點 (Top Unanswered Concerns)</h2>
        {unanswered_html}

        <h2 class="section-title">🚀 建議行動追蹤清單 (Action Items)</h2>
        <table>
            <thead>
                <tr>
                    <th style="width: 130px;">優先級</th>
                    <th style="width: 160px;">負責單位</th>
                    <th>行動方針</th>
                    <th style="width: 130px;">完成時限</th>
                </tr>
            </thead>
            <tbody>
                {action_rows}
            </tbody>
        </table>

        <footer>
            本報告由 LiveEngage v2 AI 決策引擎依據全場即時數據自動生成，供管理階層決策推動參考。
        </footer>
    </div>

    <script class="no-print">
        const mdContent = `{md_safe}`;
        function copyMarkdown() {{
            navigator.clipboard.writeText(mdContent).then(() => {{
                alert("已將 Markdown 完整內容複製至剪貼簿！");
            }}).catch(() => {{
                alert("複製失敗，請手動複製。");
            }});
        }}
    </script>
</body>
</html>"""


async def generate_session_decision_report(
    db: AsyncSession,
    *,
    user: User,
    session_id: uuid.UUID,
    force_refresh: bool = False,
    ai_override: AiConfigOverride | None = None,
) -> AiDecisionReport:
    """會後一鍵生成 AI 決策報告（支援快取與 force_refresh）。"""
    from sqlalchemy import select
    from app.models.session import Session
    from app.services import overview_service

    res = await db.execute(select(Session).where(Session.id == session_id))
    session = res.scalar_one_or_none()
    if session is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到會議活動")

    if session.host_user_id != user.id and session.org_id != user.org_id:
        raise AppError(ErrorCode.FORBIDDEN, "無權限檢視或生成此會議的決策報告")

    current_settings = dict(session.settings_jsonb or {})
    if not force_refresh and "ai_decision_report" in current_settings:
        cached_data = current_settings["ai_decision_report"]
        if isinstance(cached_data, dict):
            try:
                return AiDecisionReport.model_validate(cached_data)
            except Exception:
                pass

    started = time.perf_counter()
    analytics_data = await overview_service.extract_session_analytics_data(
        db, session_id=session.id
    )

    status = "ok"
    report_dict: dict[str, Any] = {}
    try:
        res_data = await _llm_call(
            AiFeature.GENERATE_REPORT,
            {"data": analytics_data},
            ai_override=ai_override,
        )
        if isinstance(res_data, dict) and "executive_summary" in res_data:
            report_dict = res_data
        else:
            report_dict = generate_decision_report_local(analytics_data)
    except Exception:
        status = "fallback"
        report_dict = generate_decision_report_local(analytics_data)

    now_iso = dt.datetime.now(dt.timezone.utc).isoformat()
    report_dict["session_id"] = str(session.id)
    report_dict["session_title"] = session.title or "LiveEngage 活動會議"
    if not report_dict.get("generated_at"):
        report_dict["generated_at"] = now_iso

    try:
        report = AiDecisionReport.model_validate(report_dict)
    except Exception:
        fallback_data = generate_decision_report_local(analytics_data)
        fallback_data["session_id"] = str(session.id)
        fallback_data["session_title"] = session.title or "LiveEngage 活動會議"
        fallback_data["generated_at"] = now_iso
        report = AiDecisionReport.model_validate(fallback_data)

    current_settings["ai_decision_report"] = report.model_dump()
    session.settings_jsonb = current_settings
    await db.commit()

    latency_ms = int((time.perf_counter() - started) * 1000)
    await _log_request(
        db,
        user=user,
        feature=AiFeature.GENERATE_REPORT,
        status=status,
        latency_ms=latency_ms,
        details={
            "session_id": str(session.id),
            "force_refresh": force_refresh,
            "consensus_count": len(report.key_consensuses),
            "divergence_count": len(report.divergences),
            "action_count": len(report.action_recommendations),
        },
    )

    return report


async def get_session_decision_report(
    db: AsyncSession,
    *,
    user: User,
    session_id: uuid.UUID,
) -> AiDecisionReport | None:
    """取得會議既有的 AI 決策報告（若無則回傳 None）。"""
    from sqlalchemy import select
    from app.models.session import Session

    res = await db.execute(select(Session).where(Session.id == session_id))
    session = res.scalar_one_or_none()
    if session is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到會議活動")

    if session.host_user_id != user.id and session.org_id != user.org_id:
        raise AppError(ErrorCode.FORBIDDEN, "無權限檢視此會議的決策報告")

    settings = session.settings_jsonb or {}
    report_data = settings.get("ai_decision_report")
    if not report_data or not isinstance(report_data, dict):
        return None

    try:
        return AiDecisionReport.model_validate(report_data)
    except Exception:
        return None


