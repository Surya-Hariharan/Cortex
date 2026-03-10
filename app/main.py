"""
Cortex Backend — main FastAPI application entry point.
Team SynapseX | Offline-first AI operating layer for AMD Ryzen AI edge devices.
"""

# ── Bcrypt monkeypatch for passlib 1.7.4 compatibility ───────────────────────
import bcrypt

if not hasattr(bcrypt, "__about__"):
    # passlib 1.7.4 expects bcrypt.__about__.__version__
    class BcryptAbout:
        __version__ = getattr(bcrypt, "__version__", "4.0.0")

    bcrypt.__about__ = BcryptAbout()

import asyncio
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import get_logger
from app.database.connection import close_db, init_db
from app.rag.vector_store import vector_store
from app.api.v1.router import api_router

logger = get_logger(__name__)

# ── Background task handles ──────────────────────────────────────────────────
_queue_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup → yield → shutdown."""
    # ── Startup ─────────────────────────────────────────────────────────────
    logger.info("cortex.startup", version="1.0.0", env=settings.ENV)

    # 1. Ensure data directories exist
    data_dir = Path(settings.DATA_DIR)
    for sub in ("uploads", "audio_tmp", "models", "exports", "database"):
        (data_dir / sub).mkdir(parents=True, exist_ok=True)
    logger.info("cortex.data_dirs_ready", path=str(data_dir))

    # 2. Initialise database (SQLAlchemy create_all + SQL migrations)
    await init_db()
    logger.info("cortex.db_ready")

    # 3. Load FAISS vector store from disk (no-op on first run)
    try:
        vector_store.load()
        logger.info("cortex.vector_store_ready", vectors=vector_store.total)
    except Exception as exc:  # noqa: BLE001
        logger.warning("cortex.vector_store_load_failed", error=str(exc))

    # 4. Start sync-queue background processor
    try:
        from app.sync_engine.queue_processor import run_queue_processor

        global _queue_task
        _queue_task = asyncio.create_task(run_queue_processor(), name="sync_queue")
        logger.info("cortex.sync_queue_started")
    except Exception as exc:  # noqa: BLE001
        logger.warning("cortex.sync_queue_failed", error=str(exc))

    # 5. Initialise mDNS peer discovery
    try:
        from app.mesh_network.peer_discovery import init_discovery

        device_id = str(uuid.uuid4())[:8]
        discovery = init_discovery(device_id, f"Cortex-{device_id}")
        await discovery.start()
        logger.info("cortex.mdns_started", device_id=device_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("cortex.mdns_failed", error=str(exc))

    # 6. Start mesh WebSocket server
    try:
        from app.mesh_network.peer_sync import mesh_server

        await mesh_server.start()
        logger.info("cortex.mesh_ws_started", port=settings.MESH_WS_PORT)
    except Exception as exc:  # noqa: BLE001
        logger.warning("cortex.mesh_ws_failed", error=str(exc))

    # 7. Start AI task scheduler
    try:
        from app.services.ai_task_scheduler import scheduler

        await scheduler.start()
        logger.info("cortex.task_scheduler_started")
    except Exception as exc:  # noqa: BLE001
        logger.warning("cortex.task_scheduler_failed", error=str(exc))

    # 8. Memory-aware model preload
    try:
        from app.ai_models.model_manager import model_manager

        model_manager.load_by_available_memory()
        logger.info("cortex.models_preloaded")
    except Exception as exc:  # noqa: BLE001
        logger.warning("cortex.model_preload_failed", error=str(exc))

    # 9. Start mesh propagation loop
    try:
        from app.mesh_network.peer_sync import start_mesh_propagation_loop

        await start_mesh_propagation_loop(interval_seconds=60)
        logger.info("cortex.mesh_propagation_started")
    except Exception as exc:  # noqa: BLE001
        logger.warning("cortex.mesh_propagation_failed", error=str(exc))

    # 10. Start document reindexer
    try:
        from app.services.document_reindexer import start_reindexer_loop

        await start_reindexer_loop()
        logger.info("cortex.reindexer_started")
    except Exception as exc:  # noqa: BLE001
        logger.warning("cortex.reindexer_failed", error=str(exc))

    # 11. Start vector store health monitor
    try:
        from app.services.vector_store_health import start_health_monitor

        await start_health_monitor(rebuild_on_mismatch=True)
        logger.info("cortex.vs_health_monitor_started")
    except Exception as exc:  # noqa: BLE001
        logger.warning("cortex.vs_health_monitor_failed", error=str(exc))

    logger.info("cortex.ready", host=settings.HOST, port=settings.PORT)

    yield  # ── Application running ──────────────────────────────────────────

    # ── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("cortex.shutdown_begin")

    # Stop sync queue processor
    if _queue_task and not _queue_task.done():
        try:
            from app.sync_engine.queue_processor import stop_queue_processor

            stop_queue_processor()
            await asyncio.wait_for(_queue_task, timeout=5.0)
        except Exception:  # noqa: BLE001
            _queue_task.cancel()

    # Stop mDNS discovery
    try:
        from app.mesh_network.peer_discovery import get_discovery

        disc = get_discovery()
        if disc:
            await disc.stop()
    except Exception:  # noqa: BLE001
        pass

    # Stop mesh WebSocket server
    try:
        from app.mesh_network.peer_sync import mesh_server

        await mesh_server.stop()
    except Exception:  # noqa: BLE001
        pass

    # Stop AI task scheduler
    try:
        from app.services.ai_task_scheduler import scheduler

        scheduler.stop()
    except Exception:  # noqa: BLE001
        pass

    # Stop mesh propagation loop
    try:
        from app.mesh_network.peer_sync import stop_mesh_propagation_loop

        stop_mesh_propagation_loop()
    except Exception:  # noqa: BLE001
        pass

    # Stop document reindexer
    try:
        from app.services.document_reindexer import stop_reindexer_loop

        stop_reindexer_loop()
    except Exception:  # noqa: BLE001
        pass

    # Stop vector store health monitor
    try:
        from app.services.vector_store_health import stop_health_monitor

        stop_health_monitor()
    except Exception:  # noqa: BLE001
        pass

    # Save vector store to disk
    try:
        vector_store.save()
        logger.info("cortex.vector_store_saved")
    except Exception:  # noqa: BLE001
        pass

    # Close database engine
    await close_db()
    logger.info("cortex.shutdown_complete")


# ── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="Cortex AI Backend",
    description=(
        "Offline-first AI operating layer for the Cortex desktop application. "
        "Built by team SynapseX for AMD Ryzen AI edge devices."
    ),
    version="1.0.0",
    docs_url="/docs" if settings.ENV != "production" else None,
    redoc_url="/redoc" if settings.ENV != "production" else None,
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(api_router)

# ── Observability: Prometheus /metrics endpoint ───────────────────────────────
try:
    from app.core.observability import mount_metrics

    mount_metrics(app)
except Exception:  # noqa: BLE001
    pass


# ── Root / Health endpoints ───────────────────────────────────────────────────
@app.get("/", tags=["meta"], summary="API root info")
async def root() -> dict:
    return {
        "name": "Cortex AI Backend",
        "version": "1.0.0",
        "team": "SynapseX",
        "docs": "/docs",
        "status": "online",
    }


@app.get("/health", tags=["meta"], summary="Health check")
async def health() -> JSONResponse:
    status: dict = {
        "status": "ok",
        "timestamp": time.time(),
        "services": {},
    }

    # DB ping
    try:
        from app.database.connection import AsyncSessionLocal
        from sqlalchemy import text

        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        status["services"]["database"] = "ok"
    except Exception as exc:  # noqa: BLE001
        status["services"]["database"] = f"error: {exc}"
        status["status"] = "degraded"

    # Vector store
    try:
        status["services"]["vector_store"] = {
            "status": "ok",
            "vectors": vector_store.total,
        }
    except Exception as exc:  # noqa: BLE001
        status["services"]["vector_store"] = f"error: {exc}"
        status["status"] = "degraded"

    # Model manager
    try:
        from app.ai_models.model_manager import model_manager

        status["services"]["models"] = model_manager.status()
    except Exception as exc:  # noqa: BLE001
        status["services"]["models"] = f"error: {exc}"

    # Sync queue
    try:
        from app.database.connection import AsyncSessionLocal
        from sqlalchemy import select, func
        from app.models.domain.sync import SyncQueue

        async with AsyncSessionLocal() as session:
            pending = await session.scalar(
                select(func.count(SyncQueue.id)).where(SyncQueue.status == "pending")
            )
        status["services"]["sync_queue"] = {"pending_items": pending}
    except Exception:  # noqa: BLE001
        pass

    http_status = 200 if status["status"] == "ok" else 207
    return JSONResponse(content=status, status_code=http_status)


# ── Dev entry-point ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENV == "development",
        log_level="info",
    )
