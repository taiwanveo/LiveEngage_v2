"""WebSocket 連線管理（本程序 in-memory fan-out）。

正式環境由 Redis Pub/Sub（``evt:room:{roomId}``）跨副本廣播；Redis 不可用時
降級為程序內廣播（僅適用 dev / 單副本）。
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Room 級 WebSocket 連線池。"""

    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, room_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._rooms[room_id].add(websocket)

    async def disconnect(self, room_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            self._rooms[room_id].discard(websocket)
            if not self._rooms[room_id]:
                del self._rooms[room_id]

    async def broadcast(self, room_id: str, message: dict[str, Any]) -> None:
        """廣播 JSON 至同房間所有連線（含發送者，最終一致確認）。"""
        data = json.dumps(message, default=str)
        async with self._lock:
            sockets = list(self._rooms.get(room_id, set()))
        dead: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_text(data)
            except Exception:  # noqa: BLE001 - 斷線回收
                dead.append(ws)
        for ws in dead:
            await self.disconnect(room_id, ws)


manager = ConnectionManager()
