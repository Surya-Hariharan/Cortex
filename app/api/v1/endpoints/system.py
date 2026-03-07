"""System health endpoint.

GET /system/health   — comprehensive status of all subsystems
GET /system/models   — model manager health detail
GET /system/scheduler — AI task scheduler status
"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/health")
async def system_health() -> dict:
    """Aggregate health report covering DB, FAISS, models, mesh, and sync queue."""
    report: dict = {"status": "healthy", "subsystems": {}}

    # ── Database ─────────────────────────────────────────────────────────────
    try:
        from app.database.connection import get_db_context
        from sqlalchemy import text
        async with get_db_context() as db:
            await db.execute(text("SELECT 1"))
        report["subsystems"]["database"] = {"status": "ok"}
    except Exception as exc:
        report["subsystems"]["database"] = {"status": "error", "detail": str(exc)}
        report["status"] = "degraded"

    # ── FAISS / VectorStore ───────────────────────────────────────────────────
    try:
        from app.services.vector_store_health import get_health_status
        vs_status = get_health_status()
        report["subsystems"]["vector_store"] = vs_status
        if vs_status.get("status") != "healthy":
            report["status"] = "degraded"
    except Exception as exc:
        report["subsystems"]["vector_store"] = {"status": "unknown", "detail": str(exc)}

    # ── AI Models ─────────────────────────────────────────────────────────────
    try:
        from app.ai_models.model_manager import model_manager
        report["subsystems"]["models"] = model_manager.health()
    except Exception as exc:
        report["subsystems"]["models"] = {"status": "error", "detail": str(exc)}

    # ── Mesh ─────────────────────────────────────────────────────────────────
    try:
        from app.mesh_network.peer_discovery import get_discovery
        disc = get_discovery()
        peers = disc.get_peers() if disc else []
        report["subsystems"]["mesh"] = {
            "status": "ok" if disc else "not_started",
            "peer_count": len(peers),
        }
    except Exception as exc:
        report["subsystems"]["mesh"] = {"status": "error", "detail": str(exc)}

    # ── Sync queue ────────────────────────────────────────────────────────────
    try:
        from app.database.connection import get_db_context
        from app.sync_engine.event_store import get_pending_queue
        async with get_db_context() as db:
            pending = await get_pending_queue(db, limit=1)
        report["subsystems"]["sync_queue"] = {"status": "ok", "has_pending": len(pending) > 0}
    except Exception as exc:
        report["subsystems"]["sync_queue"] = {"status": "error", "detail": str(exc)}

    # ── AI task scheduler ──────────────────────────────────────────────────────
    try:
        from app.services.ai_task_scheduler import scheduler
        report["subsystems"]["task_scheduler"] = scheduler.status()
    except Exception as exc:
        report["subsystems"]["task_scheduler"] = {"status": "error", "detail": str(exc)}

    status_code = 200 if report["status"] == "healthy" else 207
    return JSONResponse(content=report, status_code=status_code)


@router.get("/models")
async def model_health() -> dict:
    """Detailed AI model loading status and memory info."""
    from app.ai_models.model_manager import model_manager
    return model_manager.health()


@router.get("/scheduler")
async def scheduler_status() -> dict:
    """AI task scheduler queue depth and active tasks."""
    from app.services.ai_task_scheduler import scheduler
    return scheduler.status()
