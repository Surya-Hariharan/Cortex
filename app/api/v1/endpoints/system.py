"""System health endpoint.

GET /system/health   — comprehensive status of all subsystems
GET /system/models   — model manager health detail
GET /system/scheduler — AI task scheduler status
POST /system/benchmark — run benchmark and preload models
POST /system/models/{model_name}/load — load specific model
POST /system/models/{model_name}/unload — unload specific model
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(prefix="/system", tags=["System"])


class BenchmarkResult(BaseModel):
    """Benchmark execution result."""
    success: bool
    loaded_models: dict[str, bool]
    execution_time_ms: float
    message: str


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


@router.post("/benchmark")
async def run_benchmark() -> BenchmarkResult:
    """Run AI model benchmark - preloads all models and measures performance."""
    import time
    from app.ai_models.model_manager import model_manager

    start_time = time.time()

    try:
        # Preload all models (this serves as our benchmark)
        loaded_models = model_manager.load_by_available_memory()

        # Simple embedding benchmark test
        if loaded_models.get("embeddings"):
            test_text = "This is a benchmark test for the embedding model performance."
            _ = model_manager.embeddings.encode([test_text])

        execution_time = (time.time() - start_time) * 1000  # Convert to milliseconds

        return BenchmarkResult(
            success=True,
            loaded_models=loaded_models,
            execution_time_ms=execution_time,
            message=f"Benchmark completed successfully in {execution_time:.1f}ms"
        )
    except Exception as exc:
        execution_time = (time.time() - start_time) * 1000
        return BenchmarkResult(
            success=False,
            loaded_models={},
            execution_time_ms=execution_time,
            message=f"Benchmark failed: {str(exc)}"
        )


@router.post("/models/{model_name}/load")
async def load_model(model_name: str) -> dict:
    """Load a specific AI model."""
    from app.ai_models.model_manager import model_manager

    valid_models = ["embeddings", "llm", "whisper"]
    if model_name not in valid_models:
        raise HTTPException(status_code=400, detail=f"Invalid model name. Must be one of: {valid_models}")

    try:
        # Trigger lazy loading by accessing the property
        if model_name == "embeddings":
            _ = model_manager.embeddings
        elif model_name == "llm":
            _ = model_manager.llm
        elif model_name == "whisper":
            _ = model_manager.whisper

        return {"success": True, "message": f"{model_name} model loaded successfully"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load {model_name}: {str(exc)}")


@router.post("/models/{model_name}/unload")
async def unload_model(model_name: str) -> dict:
    """Unload a specific AI model from memory."""
    from app.ai_models.model_manager import model_manager

    valid_models = ["embeddings", "llm", "whisper"]
    if model_name not in valid_models:
        raise HTTPException(status_code=400, detail=f"Invalid model name. Must be one of: {valid_models}")

    try:
        success = model_manager.unload_model(model_name)
        if success:
            return {"success": True, "message": f"{model_name} model unloaded successfully"}
        else:
            return {"success": False, "message": f"{model_name} model was not loaded"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to unload {model_name}: {str(exc)}")
