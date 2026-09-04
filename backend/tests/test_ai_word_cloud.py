"""測試 AI 文字雲語意聚合（AI-001 延伸；離線降級與群聚計算）。"""

import pytest

from app.schemas.poll import WordCount, WordVariant
from app.services.ai_service import cluster_words_local


def test_cluster_words_local_empty():
    res = cluster_words_local([])
    assert res == []


def test_cluster_words_local_synonyms_and_variants():
    raw = [
        {"word": "ChatGPT", "count": 5},
        {"word": "加班太嚴重", "count": 4},
        {"word": "工時過長", "count": 3},
        {"word": "AI工具", "count": 3},
        {"word": "低薪", "count": 2},
        {"word": "薪水太少", "count": 2},
        {"word": "獨立主題", "count": 1},
    ]
    clusters = cluster_words_local(raw)

    cluster_words = [c["word"] for c in clusters]
    assert "生成式 AI 與工具" in cluster_words
    assert "工時與加班問題" in cluster_words
    assert "薪資與福利待遇" in cluster_words

    ai_cluster = next(c for c in clusters if c["word"] == "生成式 AI 與工具")
    assert ai_cluster["count"] == 8  # 5 + 3
    assert len(ai_cluster["variants"]) == 2

    overtime_cluster = next(c for c in clusters if c["word"] == "工時與加班問題")
    assert overtime_cluster["count"] == 7  # 4 + 3
    assert len(overtime_cluster["variants"]) == 2

    salary_cluster = next(c for c in clusters if c["word"] == "薪資與福利待遇")
    assert salary_cluster["count"] == 4  # 2 + 2

    solo = next(c for c in clusters if c["word"] == "獨立主題")
    assert solo["count"] == 1


def test_word_count_schema_with_variants():
    wc = WordCount(
        word="生成式 AI",
        count=8,
        variants=[
            WordVariant(word="ChatGPT", count=5),
            WordVariant(word="AI工具", count=3),
        ],
        is_ai_clustered=True,
    )
    dumped = wc.model_dump()
    assert dumped["is_ai_clustered"] is True
    assert len(dumped["variants"]) == 2
    assert dumped["variants"][0]["word"] == "ChatGPT"

def test_openrouter_provider_auto_detect():
    from app.core.config import Settings
    s = Settings(
        ai_api_key="sk-or-v1-testkey123",
        ai_provider="auto",
    )
    assert s.ai_provider == "openrouter"
    assert s.ai_base_url == "https://openrouter.ai/api/v1"
    assert s.ai_enabled is True


def test_gemini_provider_auto_detect():
    from app.core.config import Settings
    s = Settings(
        ai_api_key="AIzaSyTestKey456",
        ai_provider="auto",
    )
    assert s.ai_provider == "gemini"
    assert "googleapis.com" in s.ai_base_url
    assert s.ai_enabled is True
