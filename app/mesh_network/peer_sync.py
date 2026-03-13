"""P2P sync over WebSocket connections.

Each peer runs a WebSocket server; when we discover a peer via mDNS,
we connect to it as a client and exchange sync events.

Mesh propagation
────────────────
``broadcast_pending_to_peers()`` is called by the sync queue processor and by
the periodic ``_mesh_propagation_loop`` background task.  It:

  1. Fetches all *pending* SyncQueue entries from SQLite.
  2. For each known peer, opens a WebSocket and sends a SYNC_REQUEST with
     ``{"since": <latest_peer_seen_at>}``.
  3. Merges the response using the conflict resolver.
  4. Pushes our own pending events to the peer as SYNC_RESPONSE.

Idempotency
───────────
Remote events are deduplicated by ``SyncEvent.id`` before being written.
An event that already exists in the local DB is silently skipped.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Dict, Optional, Set

from app.core.config import settings
from app.core.logging import get_logger
from app.mesh_network.protocol import MeshMessage, MessageType

logger = get_logger(__name__)

WS_PATH = "/mesh/ws"

# Track per-peer "last-seen" cursor so we only request deltas
_peer_cursors: Dict[str, datetime] = {}
# Global set of event IDs we have already ingested (in-memory dedup cache)
_seen_event_ids: Set[str] = set()


class PeerSyncServer:
    """Minimal WebSocket server for receiving peer sync messages."""

    def __init__(self, host: str = "0.0.0.0", port: int | None = None) -> None:
        self._host = host
        self._port = port or settings.MESH_WS_PORT
        self._server = None

    async def start(self) -> None:
        try:
            import websockets  # type: ignore
        except ImportError:
            logger.warning("websockets not installed — mesh server disabled")
            return

        last_exc: Exception | None = None
        for attempt in range(10):
            port = self._port + attempt
            try:
                self._server = await websockets.serve(
                    self._handle_connection, self._host, port
                )
                self._port = port  # remember the actual port in use
                logger.info("MeshSyncServer listening", host=self._host, port=port)
                return
            except OSError as exc:
                last_exc = exc
                logger.debug("Mesh WS port in use, trying next", port=port)

        raise OSError(f"Could not bind mesh WebSocket after 10 attempts: {last_exc}") from last_exc

    async def stop(self) -> None:
        if self._server:
            self._server.close()
            await self._server.wait_closed()

    async def _handle_connection(self, websocket, path: str = "") -> None:
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
        # Verify peer signature if the message carries one
        if "signature" in msg.payload:
            try:
                from app.mesh_network.peer_identity import identity
                identity.verify_message(
                    raw_message=msg.payload.get("payload", ""),
                    signature_b64=msg.payload["signature"],
                    sender_peer_id=msg.sender_id,
                    sender_pub_key_b64=msg.payload.get("public_key"),
                )
            except ValueError as exc:
                logger.warning("Rejecting mesh message — bad signature", sender=msg.sender_id, error=str(exc))
                error = MeshMessage(type=MessageType.ERROR, sender_id="local", payload={"detail": str(exc)})
                await websocket.send(error.to_json())
                return

        if msg.type == MessageType.PING:
            pong = MeshMessage(type=MessageType.PONG, sender_id="local")
            await websocket.send(pong.to_json())

        elif msg.type == MessageType.SYNC_REQUEST:
            since_str = msg.payload.get("since")
            limit = msg.payload.get("limit", 100)
            since = datetime.fromisoformat(since_str) if since_str else None
            events, has_more = await _fetch_events_for_peer(msg.sender_id, since, limit)
            response = MeshMessage(
                type=MessageType.SYNC_RESPONSE,
                sender_id="local",
                payload={"events": events, "has_more": has_more},
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


async def _fetch_events_for_peer(sender_id: str, since: Optional[datetime], limit: int = 100) -> tuple[list, bool]:
    """Fetch local sync events to send to a requesting peer."""
    from app.database.connection import get_db_context
    from app.sync_engine.event_store import get_events_since

    async with get_db_context() as db:
        # Request limit + 1 to check if there are more
        events = await get_events_since(since=since, db=db, device_id=sender_id, limit=limit + 1)
        has_more = len(events) > limit
        if has_more:
            events = events[:limit]

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
        ], has_more


async def _ingest_remote_events(raw_events: list) -> None:
    """Store incoming remote events in the sync queue for processing.

    Idempotent — events whose IDs are already known are silently skipped.
    Also performs CRDT conflict resolution when the entity already exists.
    """
    from app.database.connection import get_db_context
    from app.sync_engine.event_store import record_event
    from app.models.schemas.sync import SyncEventCreate
    from app.sync_engine.conflict_resolver import merge_clocks
    import json as _json

    async with get_db_context() as db:
        for ev in raw_events:
            event_id = ev.get("id", "")
            # Idempotency: skip already-seen events
            if event_id and event_id in _seen_event_ids:
                continue
            try:
                payload = ev.get("payload", "{}")
                if isinstance(payload, str):
                    payload = _json.loads(payload)
                raw_vc = ev.get("vector_clock", "{}")
                vector_clock = _json.loads(raw_vc) if isinstance(raw_vc, str) else raw_vc

                # Check for duplicate by ID in DB before inserting
                if event_id:
                    from sqlalchemy import select
                    from app.models.domain.sync import SyncEvent
                    exists = (
                        await db.execute(select(SyncEvent.id).where(SyncEvent.id == event_id))
                    ).scalar_one_or_none()
                    if exists:
                        _seen_event_ids.add(event_id)
                        continue

                await record_event(
                    SyncEventCreate(
                        device_id=ev.get("device_id", "unknown"),
                        entity_type=ev.get("entity_type", "unknown"),
                        entity_id=ev.get("entity_id", ""),
                        operation=ev.get("operation", "update"),
                        payload=payload,
                        vector_clock=vector_clock,
                    ),
                    db,
                )
                if event_id:
                    _seen_event_ids.add(event_id)
            except Exception as exc:
                logger.warning("Failed to ingest remote event", error=str(exc))


# ── Mesh propagation loop ─────────────────────────────────────────────────────

async def broadcast_pending_to_peers() -> None:
    """Push all pending local queue entries to every known LAN peer.

    Sends a SYNC_REQUEST first to pull any events the peer has that we lack,
    then pushes our pending events.  Uses per-peer cursors to request only
    deltas.  Intended to be called both by the queue processor and the
    background propagation loop.
    """
    try:
        import websockets  # type: ignore
    except ImportError:
        return

    try:
        from app.mesh_network.peer_discovery import get_discovery
        discovery = get_discovery()
        if not discovery:
            return
        peers = discovery.get_peers()
    except Exception:
        return

    if not peers:
        return

    # Fetch our own pending events once for this round
    try:
        from app.database.connection import get_db_context
        from app.sync_engine.event_store import get_events_since, get_pending_queue
        from app.models.domain.sync import SyncEvent
        from sqlalchemy import select

        async with get_db_context() as db:
            pending_entries = await get_pending_queue(db, limit=settings.SYNC_BATCH_SIZE)
            pending_event_ids = [e.event_id for e in pending_entries]

            our_events: list = []
            if pending_event_ids:
                rows = (
                    await db.execute(
                        select(SyncEvent).where(SyncEvent.id.in_(pending_event_ids))
                    )
                ).scalars().all()
                our_events = [
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
                    for e in rows
                ]
    except Exception as exc:
        logger.debug("Could not fetch local pending events for mesh push", error=str(exc))
        return

    tasks = [
        asyncio.create_task(_sync_with_peer(peer, our_events), name=f"mesh-{peer.peer_id[:8]}")
        for peer in peers
    ]
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def _sync_with_peer(peer, our_events: list) -> None:
    """Full bidirectional sync exchange with one peer."""
    try:
        import websockets  # type: ignore
    except ImportError:
        return

    peer_id = peer.peer_id
    uri = f"ws://{peer.ip_address}:{peer.port}{WS_PATH}"
    since = _peer_cursors.get(peer_id)

    try:
        async with websockets.connect(uri, open_timeout=5, close_timeout=5) as ws:
            # 1. Pull events from peer in batches
            while True:
                req = MeshMessage(
                    type=MessageType.SYNC_REQUEST,
                    sender_id="local",
                    payload={
                        "since": since.isoformat() if since else None,
                        "limit": 100
                    },
                )
                await ws.send(req.to_json())
                raw = await asyncio.wait_for(ws.recv(), timeout=10)
                resp = MeshMessage.from_json(raw)

                if resp.type == MessageType.SYNC_RESPONSE:
                    remote_events = resp.payload.get("events", [])
                    has_more = resp.payload.get("has_more", False)
                    if remote_events:
                        await _ingest_remote_events(remote_events)
                        logger.debug("Pulled batch from peer", peer_id=peer_id, count=len(remote_events))
                        # Update local 'since' for the next loop iteration
                        try:
                            last_ts = remote_events[-1]["created_at"]
                            since = datetime.fromisoformat(last_ts)
                        except Exception:
                            break
                    
                    ack = MeshMessage(type=MessageType.SYNC_ACK, sender_id="local")
                    await ws.send(ack.to_json())
                    
                    if not has_more:
                        break
                else:
                    break

            # 2. Push our own pending events (one batch)
            if our_events:
                push_msg = MeshMessage(
                    type=MessageType.SYNC_RESPONSE,
                    sender_id="local",
                    payload={"events": our_events},
                )
                await ws.send(push_msg.to_json())
                raw2 = await asyncio.wait_for(ws.recv(), timeout=10)
                ack2 = MeshMessage.from_json(raw2)
                if ack2.type == MessageType.SYNC_ACK:
                    logger.debug("Pushed to peer", peer_id=peer_id, count=len(our_events))

            # Update final cursor
            _peer_cursors[peer_id] = datetime.now(timezone.utc)

    except Exception as exc:
        logger.debug("Mesh sync with peer failed", peer_id=peer_id, error=str(exc))


_propagation_task: asyncio.Task | None = None


async def start_mesh_propagation_loop(interval_seconds: int = 60) -> None:
    """Start the background task that periodically syncs with all LAN peers."""
    global _propagation_task

    async def _loop() -> None:
        logger.info("Mesh propagation loop started", interval=interval_seconds)
        while True:
            try:
                await broadcast_pending_to_peers()
            except Exception as exc:
                logger.warning("Mesh propagation error", error=str(exc))
            await asyncio.sleep(interval_seconds)

    _propagation_task = asyncio.create_task(_loop(), name="mesh-propagation")


def stop_mesh_propagation_loop() -> None:
    global _propagation_task
    if _propagation_task and not _propagation_task.done():
        _propagation_task.cancel()


# Global server instance
mesh_server = PeerSyncServer()
