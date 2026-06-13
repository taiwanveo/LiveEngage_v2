"""WebSocket Gateway（SDS §6.1、鐵律 1：只做廣播，不做寫入）。"""

from __future__ import annotations

import asyncio
import logging
from enum import StrEnum

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.errors import AppError
from app.core.tokens import (
    decode_access_token,
    decode_participant_token,
)
from app.realtime.manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["realtime"])

PING_INTERVAL_S = 25


class WsMode(StrEnum):
    PARTICIPANT = "participant"
    PRESENT = "present"
    HOST = "host"


def _authenticate(token: str, mode: WsMode) -> tuple[str, str]:
    """驗證 JWT 並回傳 (subject_id, room_id_str)。"""
    if mode == WsMode.PARTICIPANT:
        pclaims = decode_participant_token(token)
        room = str(pclaims.room_id) if pclaims.room_id else ""
        return str(pclaims.participant_id), room
    aclaims = decode_access_token(token)
    return str(aclaims.user_id), ""


@router.websocket("/ws")
async def websocket_gateway(
    websocket: WebSocket,
    token: str = Query(...),
    room: str = Query(...),
    mode: WsMode = Query(WsMode.PARTICIPANT),
) -> None:
    """WS 端點：wss://…/ws?token=&room=&mode=（SDS §6.1）。"""
    try:
        _authenticate(token, mode)
    except AppError as exc:
        await websocket.close(code=4401, reason=exc.message)
        return

    room_id = room
    await manager.connect(room_id, websocket)

    async def _pinger() -> None:
        while True:
            await asyncio.sleep(PING_INTERVAL_S)
            try:
                await websocket.send_json({"type": "ping"})
            except Exception:
                break

    ping_task = asyncio.create_task(_pinger())
    try:
        while True:
            # 鐵律 1：Client 訊息僅作 keepalive；業務寫入走 REST
            msg = await websocket.receive_text()
            if msg.strip().lower() == "pong":
                continue
    except WebSocketDisconnect:
        pass
    finally:
        ping_task.cancel()
        await manager.disconnect(room_id, websocket)
