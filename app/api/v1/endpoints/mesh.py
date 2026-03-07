"""Mesh network peer management endpoint."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.mesh_network.peer_discovery import get_discovery
from app.mesh_network.peer_sync import push_to_peer
from app.models.schemas.mesh import MeshPeersResponse, MeshSyncRequest, PeerInfo

router = APIRouter(prefix="/mesh", tags=["Mesh"])


@router.get("/peers", response_model=MeshPeersResponse)
async def list_peers() -> MeshPeersResponse:
    """List currently discovered LAN peers."""
    discovery = get_discovery()
    peers = discovery.get_peers() if discovery else []
    return MeshPeersResponse(peers=peers, total=len(peers))


@router.post("/sync")
async def sync_with_peer(request: MeshSyncRequest) -> dict:
    """Trigger manual sync push to a specific peer."""
    discovery = get_discovery()
    if not discovery:
        raise HTTPException(status_code=503, detail="Mesh discovery not running")

    peer = discovery.get_peer(request.target_peer_id)
    if not peer:
        raise HTTPException(status_code=404, detail="Peer not found")

    from app.database.connection import get_db_context
    from app.sync_engine.event_store import get_events_since
    import json

    async with get_db_context() as db:
        events = await get_events_since(since=request.since, db=db)
        raw = [
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

    success = await push_to_peer(peer.ip_address, peer.port, raw)
    return {"success": success, "events_pushed": len(raw), "peer_id": request.target_peer_id}
