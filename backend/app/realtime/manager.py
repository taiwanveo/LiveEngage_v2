"""WebSocket 連線管理（本程序 in-memory fan-out）。

正式環境由 Redis Pub/Sub（``evt:room:{roomId}``）跨副本廣播；Redis 不可用時
降級為程序內廣播（僅適用 dev / 單副本）。

廣播支援依連線 ``mode``（participant/present/host）過濾，對應 SDS §6.3
事件接收端規則（例如 pending 問題僅送 host）。
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
    """Room 級 WebSocket 連線池（記錄每條連線的 mode）。"""

    def __init__(self) -> None:
        self._rooms: dict[str, dict[WebSocket, str]] = defaultdict(dict)
        self._lock = asyncio.Lock()

    async def connect(
        self, room_id: str, websocket: WebSocket, *, mode: str = "participant"
    ) -> None:
        await websocket.accept()
        async with self._lock:
            self._rooms[room_id][websocket] = mode

    async def disconnect(self, room_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            conns = self._rooms.get(room_id)
            if conns is not None:
                conns.pop(websocket, None)
                if not conns:
                    del self._rooms[room_id]

    async def broadcast(
        self,
        room_id: str,
        message: dict[str, Any],
        *,
        target_modes: set[str] | None = None,
    ) -> None:
        """廣播 JSON 至同房間連線；``target_modes`` 為 None 時送全部。"""
        data = json.dumps(message, default=str)
        async with self._lock:
            targets = [
                ws
                for ws, mode in self._rooms.get(room_id, {}).items()
                if target_modes is None or mode in target_modes
            ]
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_text(data)
            except Exception:  # noqa: BLE001 - 斷線回收
                dead.append(ws)
        for ws in dead:
            await self.disconnect(room_id, ws)


manager = ConnectionManager()
