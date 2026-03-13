"""System health endpoint.

GET /system/health   — comprehensive status of all subsystems
GET /system/models   — model manager health detail
GET /system/scheduler — AI task scheduler status
POST /system/benchmark — run benchmark and preload models
POST /system/models/{model_name}/load — load specific model
POST /system/models/{model_name}/unload — unload specific model
POST /system/internet-status — notify backend of internet connectivity change
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


class InternetStatusRequest(BaseModel):
    """Internet connectivity status from the Electron main process."""
    online: bool


class PrivacyModeRequest(BaseModel):
    """Toggle privacy mode (cloud APIs disabled)."""
    enabled: bool


# Runtime state: tracks whether internet is online (updated by Electron IPC)
_internet_online: bool = False


class RuntimeConfig(BaseModel):
    """Runtime and precision preference from the frontend."""
    runtime: str   # "standard" | "onnx"
    precision: str  # "fp32" | "fp16" | "int8"


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


@router.post("/internet-status")
async def update_internet_status(body: InternetStatusRequest) -> dict:
    """Receive internet connectivity status from the Electron main process.

    When online=True  → switch LLM and embeddings to cloud APIs (Gemini/Groq)
                        for higher quality responses.
    When online=False → switch to local inference (Ollama / ONNX) so the app
                        keeps working fully offline.
    """
    global _internet_online
    _internet_online = body.online

    from app.services.hybrid_router import get_privacy_mode
    from app.ai_models.model_manager import model_manager

    results: dict = {"online": body.online, "llm_mode": None, "embeddings_mode": None}

    # Only switch modes if privacy mode is not active
    if get_privacy_mode():
        results["llm_mode"] = "local (privacy)"
        results["embeddings_mode"] = "local (privacy)"
        return results

    # Switch LLM mode
    try:
        llm = model_manager.llm  # trigger lazy load if needed
        if body.online:
            results["llm_mode"] = llm.switch_to_cloud()
        else:
            results["llm_mode"] = llm.switch_to_local()
    except Exception as exc:
        results["llm_error"] = str(exc)

    # Switch embeddings mode
    try:
        emb = model_manager.embeddings
        if body.online:
            emb.switch_to_cloud()
            results["embeddings_mode"] = "api"
        else:
            emb.switch_to_local()
            results["embeddings_mode"] = "local"
    except Exception as exc:
        results["embeddings_error"] = str(exc)

    return results


@router.get("/resources")
async def system_resources() -> dict:
    """Real-time CPU, memory, disk, and hardware accelerator detection."""
    import psutil
    vm = psutil.virtual_memory()
    disk = psutil.disk_usage('/')

    # Detect ONNX Runtime execution providers (DirectML = AMD GPU/NPU, CUDA = NVIDIA)
    hardware: dict = {"cpu": True, "directml": False, "cuda": False, "npu": False, "providers": []}
    try:
        import onnxruntime as ort
        providers = ort.get_available_providers()
        hardware["providers"] = providers
        hardware["directml"] = "DmlExecutionProvider" in providers
        hardware["cuda"] = "CUDAExecutionProvider" in providers
        # AMD NPU is exposed through DirectML on Ryzen AI hardware
        hardware["npu"] = hardware["directml"]
    except Exception:
        pass

    return {
        "cpu_percent": psutil.cpu_percent(interval=0.1),
        "memory": {
            "used_mb": vm.used // (1024 * 1024),
            "total_mb": vm.total // (1024 * 1024),
            "percent": vm.percent,
        },
        "disk": {
            "used_gb": disk.used // (1024 ** 3),
            "total_gb": disk.total // (1024 ** 3),
            "percent": disk.percent,
        },
        "hardware": hardware,
    }


@router.post("/scheduler/pause")
async def pause_scheduler() -> dict:
    """Pause the AI task scheduler — new tasks queue up but don't execute."""
    from app.services.ai_task_scheduler import scheduler
    scheduler.pause()
    return {"paused": True, "message": "Pipeline paused"}


@router.post("/scheduler/resume")
async def resume_scheduler() -> dict:
    """Resume the AI task scheduler after a pause."""
    from app.services.ai_task_scheduler import scheduler
    scheduler.resume()
    return {"paused": False, "message": "Pipeline resumed"}


@router.post("/runtime")
async def set_runtime(body: RuntimeConfig) -> dict:
    """Set inference runtime and precision preference.

    runtime='onnx'     → use local ONNX (offline-capable)
    runtime='standard' → use cloud APIs when available (Gemini/Groq)
    """
    from app.ai_models.model_manager import model_manager

    if body.runtime == "standard":
        try:
            model_manager.llm.switch_to_cloud()
            model_manager.embeddings.switch_to_cloud()
        except Exception:
            pass
    else:
        try:
            model_manager.llm.switch_to_local()
            model_manager.embeddings.switch_to_local()
        except Exception:
            pass

    return {"runtime": body.runtime, "precision": body.precision, "applied": True}


@router.get("/mode")
async def get_current_mode() -> dict:
    """Return the current LLM mode, privacy state, and internet connectivity."""
    from app.ai_models.model_manager import model_manager
    from app.services.hybrid_router import get_privacy_mode

    try:
        llm_mode = model_manager.llm._mode
    except Exception:
        llm_mode = "unknown"

    return {
        "llm_mode": llm_mode,
        "privacy_mode": get_privacy_mode(),
        "internet_online": _internet_online,
    }


@router.post("/privacy")
async def set_privacy(body: PrivacyModeRequest) -> dict:
    """Enable or disable Privacy Mode (cloud APIs disabled, local inference only)."""
    from app.ai_models.model_manager import model_manager
    from app.services.hybrid_router import set_privacy_mode, get_privacy_mode

    set_privacy_mode(body.enabled)

    if body.enabled:
        try:
            model_manager.llm.switch_to_local()
            model_manager.embeddings.switch_to_local()
        except Exception:
            pass

    try:
        llm_mode = model_manager.llm._mode
    except Exception:
        llm_mode = "unknown"

    return {"privacy_mode": get_privacy_mode(), "llm_mode": llm_mode}
