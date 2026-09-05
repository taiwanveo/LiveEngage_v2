"""測試主持人手動拖曳聚合與解除分離功能（BE-005 / AI-001 延伸）。"""

import pytest
import uuid
from unittest.mock import AsyncMock, patch
from app.models.enums import InteractionType, InteractionStatus
from app.models.interaction import Interaction
from app.models.user import User, UserRole
from app.schemas.poll import (
    WordCount,
    WordVariant,
    ManualClusterMergeRequest,
    ManualClusterSplitRequest,
)
from app.services.poll_service import (
    _apply_manual_merges,
    manual_merge_cluster,
    manual_split_cluster,
)


def test_apply_manual_merges():
    """測試 _apply_manual_merges 能正確將指定詞合併並加總票數、標記 is_manual。"""
    clustered = [
        WordCount(
            word="瑪利歐",
            count=3,
            variants=[WordVariant(word="瑪利歐", count=3)],
            is_ai_clustered=True,
            is_manual=False,
        ),
        WordCount(
            word="路易吉",
            count=2,
            variants=[WordVariant(word="路易吉", count=2)],
            is_ai_clustered=False,
            is_manual=False,
        ),
        WordCount(
            word="碧姬公主",
            count=1,
            variants=[WordVariant(word="碧姬公主", count=1)],
            is_ai_clustered=False,
            is_manual=False,
        ),
    ]

    merges = [{"source": "路易吉", "target": "瑪利歐"}]
    res = _apply_manual_merges(clustered, merges)

    assert len(res) == 2
    mario = next(w for w in res if w.word == "瑪利歐")
    assert mario.count == 5
    assert mario.is_manual is True
    assert mario.is_ai_clustered is True
    assert len(mario.variants) == 2
    luigi_v = next(v for v in mario.variants if v.word == "路易吉")
    assert luigi_v.count == 2
    assert luigi_v.is_manual is True


@pytest.mark.asyncio
async def test_manual_merge_and_split_service():
    """整合測試 manual_merge_cluster 與 manual_split_cluster。"""
    poll_id = uuid.uuid4()
    room_id = uuid.uuid4()
    user_id = uuid.uuid4()
    org_id = uuid.uuid4()

    mock_host = User(
        id=user_id,
        org_id=org_id,
        email="host@example.com",
        role=UserRole.HOST,
        name="Host",
    )

    interaction = Interaction(
        id=poll_id,
        room_id=room_id,
        type=InteractionType.WORD_CLOUD,
        title="你最喜歡的遊戲角色",
        status=InteractionStatus.ACTIVE,
        settings_jsonb={
            "ai_cluster": True,
            "ai_cluster_cache": [
                {
                    "word": "瑪利歐",
                    "count": 3,
                    "variants": [{"word": "瑪利歐", "count": 3, "is_manual": False}],
                    "is_ai_clustered": False,
                    "is_manual": False,
                },
                {
                    "word": "庫巴",
                    "count": 2,
                    "variants": [{"word": "庫巴", "count": 2, "is_manual": False}],
                    "is_ai_clustered": False,
                    "is_manual": False,
                },
            ],
            "ai_cluster_cache_count": 5,
        },
    )

    mock_db = AsyncMock()
    mock_db.commit = AsyncMock()

    with (
        patch("app.services.poll_service._load_poll_for_host", return_value=(interaction, room_id, org_id)),
        patch("app.services.poll_service._count_responses", return_value=5),
        patch("app.realtime.events.publish", new_callable=AsyncMock) as mock_pub,
    ):
        # 1. 執行手動合併：將「庫巴」合併至「瑪利歐」
        merge_payload = ManualClusterMergeRequest(source_word="庫巴", target_word="瑪利歐")
        res_merge = await manual_merge_cluster(mock_db, poll_id, mock_host, merge_payload)

        assert len(res_merge.word_counts) == 1
        mario = res_merge.word_counts[0]
        assert mario.word == "瑪利歐"
        assert mario.count == 5
        assert mario.is_manual is True
        assert len(mario.variants) == 2
        assert any(v.word == "庫巴" and v.is_manual for v in mario.variants)
        assert mock_pub.called

        # 2. 執行手動分離：將「庫巴」從「瑪利歐」中分離解除
        split_payload = ManualClusterSplitRequest(cluster_word="瑪利歐", variant_word="庫巴")
        res_split = await manual_split_cluster(mock_db, poll_id, mock_host, split_payload)

        assert len(res_split.word_counts) == 2
        words = {w.word: w for w in res_split.word_counts}
        assert "瑪利歐" in words
        assert "庫巴" in words
        assert words["瑪利歐"].count == 3
        assert words["瑪利歐"].is_manual is False
        assert words["庫巴"].count == 2
        assert words["庫巴"].is_manual is False
