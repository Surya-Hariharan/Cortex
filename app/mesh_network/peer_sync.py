"""P2P sync over WebSocket connections.

Each peer runs a WebSocket server; when we discover a peer via mDNS,
we connect to it as a client and exchange sync events.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import Optional

from app.core.config import settings
from app.core.logging import get_logger
from app.mesh_network.protocol import MeshMessage, MessageType

logger = get_logger(__name__)

WS_PATH = "/mesh/ws"


class PeerSyncServer:
    """Minimal WebSocket server for receiving peer sync messages."""

    def __init__(self, host: str = "0.0.0.0", port: int | None = None) -> None:
        self._host = host
        self._port = port or settings.MESH_UDP_PORT
        self._server = None

    async def start(self) -> None:
        try:
            import websockets  # type: ignore
        except ImportError:
            logger.warning("websockets not installed — mesh server disabled")
            return

        self._server = await websockets.serve(
            self._handle_connection, self._host, self._port
        )
        logger.info("MeshSyncServer listening", host=self._host, port=self._port)

    async def stop(self) -> None:
        if self._server:
            self._server.close()
            await self._server.wait_closed()

    async def _handle_connection(self, websocket, path: str) -> None:
        logger.debug("Peer connected", path=path)
        try:
            async for raw in websocket:
                try:
                    msg = MeshMessage.from_json(raw)
                    await self._dispatch(msg, websocket)
                except Exception as exc:
                    logger.warning("Bad mesh message", error=str(exc))
        except Exception as exc:
            logger.debug("Peer disconnected", error=str(exc))

    async def _dispatch(self, msg: MeshMessage, websocket) -> None:
        if msg.type == MessageType.PING:
            pong = MeshMessage(type=MessageType.PONG, sender_id="local")
            await websocket.send(pong.to_json())

        elif msg.type == MessageType.SYNC_REQUEST:
            since_str = msg.payload.get("since")
            since = datetime.fromisoformat(since_str) if since_str else None
            events = await _fetch_events_for_peer(msg.sender_id, since)
            response = MeshMessage(
                type=MessageType.SYNC_RESPONSE,
                sender_id="local",
                payload={"events": events},
            )
            await websocket.send(response.to_json())

        elif msg.type == MessageType.SYNC_RESPONSE:
            events = msg.payload.get("events", [])
            await _ingest_remote_events(events)
            ack = MeshMessage(type=MessageType.SYNC_ACK, sender_id="local")
            await websocket.send(ack.to_json())


async def push_to_peer(peer_ip: str, peer_port: int, events: list) -> bool:
    """Push our events to a remote peer over WebSocket."""
    try:
        import websockets  # type: ignore
    except ImportError:
        return False

    uri = f"ws://{peer_ip}:{peer_port}{WS_PATH}"
    try:
        async with websockets.connect(uri, open_timeout=5) as ws:
            msg = MeshMessage(
                type=MessageType.SYNC_RESPONSE,
                sender_id="local",
                payload={"events": events},
            )
            await ws.send(msg.to_json())
            raw = await asyncio.wait_for(ws.recv(), timeout=5)
            ack = MeshMessage.from_json(raw)
            return ack.type == MessageType.SYNC_ACK
    except Exception as exc:
        logger.warning("Push to peer failed", ip=peer_ip, error=str(exc))
        return False


async def _fetch_events_for_peer(sender_id: str, since: Optional[datetime]) -> list:
    """Fetch local sync events to send to a requesting peer."""
    from app.database.connection import get_db_context
    from app.sync_engine.event_store import get_events_since

    async with get_db_context() as db:
        events = await get_events_since(since=since, db=db, device_id=sender_id)
        return [
            {
                "id": e.id,
                "device_id": e.device_id,
                "entity_type": e.entity_type,
                "entity_id": e.entity_id,
                "operation": e.operation,
                "payload": e.payload,
                "vector_clock": e.vector_clock,
                "created_at": e.created_at.isoformat(),
            }
            for e in events
        ]


async def _ingest_remote_events(raw_events: list) -> None:
    """Store incoming remote events in the sync queue for processing."""
    from app.database.connection import get_db_context
    from app.sync_engine.event_store import record_event
    from app.models.schemas.sync import SyncEventCreate
    import json as _json

    async with get_db_context() as db:
        for ev in raw_events:
            try:
                payload = ev.get("payload", "{}")
                if isinstance(payload, str):
                    payload = _json.loads(payload)
                await record_event(
                    SyncEventCreate(
                        device_id=ev.get("device_id", "unknown"),
                        entity_type=ev.get("entity_type", "unknown"),
                        entity_id=ev.get("entity_id", ""),
                        operation=ev.get("operation", "update"),
                        payload=payload,
                        vector_clock=_json.loads(ev.get("vector_clock", "{}")),
                    ),
                    db,
                )
            except Exception as exc:
                logger.warning("Failed to ingest remote event", error=str(exc))


# Global server instance
mesh_server = PeerSyncServer()
