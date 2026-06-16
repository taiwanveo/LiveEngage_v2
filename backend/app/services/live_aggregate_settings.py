"""即時聚合顯示設定（live_aggregate_screen / live_aggregate_join）。"""

from __future__ import annotations

from typing import Any

from app.models.enums import InteractionStatus, InteractionType
from app.models.interaction import Interaction
from app.schemas.poll import POLL_TYPES

LIVE_AGGREGATE_SCREEN = "live_aggregate_screen"
LIVE_AGGREGATE_JOIN = "live_aggregate_join"

_LIVE_PHASE = frozenset({InteractionStatus.ACTIVE, InteractionStatus.LOCKED})


def default_live_aggregate(type_: InteractionType | str) -> tuple[bool, bool]:
    """建立互動時的預設值：(screen, join)。"""
    if type_ in POLL_TYPES:
        return True, False
    if type_ == InteractionType.IDEAS:
        return True, True
    return False, False


def merge_live_aggregate_defaults(
    type_: InteractionType | str,
    settings: dict[str, Any] | None,
) -> dict[str, Any]:
    """合併 settings，補上未設定的 live aggregate 預設。"""
    merged = dict(settings or {})
    screen_default, join_default = default_live_aggregate(type_)
    if LIVE_AGGREGATE_SCREEN not in merged:
        merged[LIVE_AGGREGATE_SCREEN] = screen_default
    if LIVE_AGGREGATE_JOIN not in merged:
        merged[LIVE_AGGREGATE_JOIN] = join_default
    return merged


def read_live_aggregate(settings: dict[str, Any] | None) -> tuple[bool, bool]:
    """讀取 settings 中的即時聚合開關（缺省依 type 外層補預設）。"""
    raw = settings or {}
    screen = raw.get(LIVE_AGGREGATE_SCREEN)
    join = raw.get(LIVE_AGGREGATE_JOIN)
    return (
        screen if isinstance(screen, bool) else False,
        join if isinstance(join, bool) else False,
    )


def read_live_aggregate_for_type(
    settings: dict[str, Any] | None,
    type_: InteractionType | str,
) -> tuple[bool, bool]:
    """讀取開關；缺省時依互動類型套用預設。"""
    screen_default, join_default = default_live_aggregate(type_)
    raw = settings or {}
    screen = raw.get(LIVE_AGGREGATE_SCREEN)
    join = raw.get(LIVE_AGGREGATE_JOIN)
    return (
        screen if isinstance(screen, bool) else screen_default,
        join if isinstance(join, bool) else join_default,
    )


def live_aggregate_ws_modes(screen_on: bool, join_on: bool) -> set[str]:
    """poll_response_submitted / ideas 等即時聚合 WS 目標 mode。"""
    modes = {"host", "present"}
    if screen_on:
        modes.add("screen")
    if join_on:
        modes.add("participant")
    return modes


def can_view_poll_aggregate(
    interaction: Interaction,
    *,
    is_host_workbench: bool,
    is_screen: bool,
    is_participant: bool,
) -> bool:
    """Poll 結果 API 權限：Host 工作台永遠可看；其餘依揭曉與即時開關。"""
    if is_host_workbench:
        return True
    if interaction.result_visible:
        return True
    if interaction.status not in _LIVE_PHASE:
        return False
    screen_on, join_on = read_live_aggregate_for_type(
        interaction.settings_jsonb, interaction.type
    )
    if is_screen:
        return screen_on
    if is_participant:
        return join_on
    return True


def can_view_ideas_board_aggregate(
    interaction: Interaction,
    *,
    is_host_workbench: bool,
    is_screen: bool,
    is_participant: bool,
) -> bool:
    """點子牆是否可看他人內容（進行中依開關；結束後一律公開）。"""
    if is_host_workbench:
        return True
    if interaction.result_visible:
        return True
    if interaction.status == InteractionStatus.STOPPED:
        return True
    if interaction.status not in _LIVE_PHASE:
        return False
    screen_on, join_on = read_live_aggregate_for_type(
        interaction.settings_jsonb, interaction.type
    )
    if is_screen:
        return screen_on
    if is_participant:
        return join_on
    return True


def ideas_ws_modes(interaction: Interaction) -> set[str]:
    """Ideas 事件 WS 目標 mode（進行中依開關）。"""
    if interaction.status not in _LIVE_PHASE:
        return {"host", "present", "screen", "participant"}
    screen_on, join_on = read_live_aggregate_for_type(
        interaction.settings_jsonb, interaction.type
    )
    return live_aggregate_ws_modes(screen_on, join_on)
