"""AI 文字雲語意聚合單元測試（同義詞聚合、實體縮寫對照、字串變體容錯）。"""

import pytest
from app.schemas.poll import WordCount, WordVariant
from app.services.ai_service import cluster_words_local, cluster_word_cloud


def test_cluster_words_cht_synonyms():
    """測試 CHT、中華電信公司、中華電信同義詞群聚合成單一代表詞與加總票數。"""
    raw_words = [
        {"word": "中華電信", "count": 2},
        {"word": "中華電信公司", "count": 1},
        {"word": "CHT", "count": 3},
    ]
    clusters = cluster_words_local(raw_words)
    assert len(clusters) == 1
    c = clusters[0]
    assert c["word"] == "中華電信"
    assert c["count"] == 6
    assert len(c["variants"]) == 3
    words_in_variants = {v["word"] for v in c["variants"]}
    assert words_in_variants == {"中華電信", "中華電信公司", "CHT"}


def test_cluster_words_tech_aliases():
    """測試台積電、TSMC 等科技巨頭別名聚合。"""
    raw_words = [
        {"word": "TSMC", "count": 5},
        {"word": "台積電", "count": 3},
        {"word": "台灣積體電路", "count": 1},
    ]
    clusters = cluster_words_local(raw_words)
    assert len(clusters) == 1
    assert clusters[0]["word"] == "台積電"
    assert clusters[0]["count"] == 9
    assert len(clusters[0]["variants"]) == 3


def test_cluster_words_substring_matching():
    """測試未在別名表中的相似詞透過子字串聚合。"""
    raw_words = [
        {"word": "效能優化", "count": 2},
        {"word": "優化", "count": 1},
    ]
    clusters = cluster_words_local(raw_words)
    assert len(clusters) == 1
    assert clusters[0]["count"] == 3


def test_cluster_words_unrelated_remain_separate():
    """測試無關聯詞彙各自獨立成群。"""
    raw_words = [
        {"word": "紅蘿蔔", "count": 2},
        {"word": "瑪莉歐", "count": 1},
    ]
    clusters = cluster_words_local(raw_words)
    assert len(clusters) == 2
    assert {c["word"] for c in clusters} == {"紅蘿蔔", "瑪莉歐"}


@pytest.mark.asyncio
async def test_cluster_word_cloud_schema():
    """測試 cluster_word_cloud 輸出型別與結構符合 WordCount 規範。"""
    words = [
        WordCount(word="中華電信", count=1),
        WordCount(word="中華電信公司", count=1),
        WordCount(word="CHT", count=1),
    ]

    class FakeSession:
        pass

    res = await cluster_word_cloud(FakeSession(), words=words)
    assert len(res) == 1
    assert isinstance(res[0], WordCount)
    assert res[0].word == "中華電信"
    assert res[0].count == 3
    assert res[0].is_ai_clustered is True
    assert len(res[0].variants) == 3
    for v in res[0].variants:
        assert isinstance(v, WordVariant)
