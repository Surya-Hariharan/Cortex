"""Cortex backend redesign baseline.

Database and API domain routes were intentionally removed to support a full
schema/application redesign.
"""

from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("cortex.startup", version="1.0.0", mode="redesign-baseline")
    yield
    logger.info("cortex.shutdown_complete")


app = FastAPI(
    title="Cortex Backend (Redesign Baseline)",
    description="Temporary minimal backend while database and RAG are redesigned.",
    version="1.0.0",
    docs_url="/docs" if settings.ENV != "production" else None,
    redoc_url="/redoc" if settings.ENV != "production" else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Correlation-ID"],
)


@app.get("/", tags=["meta"], summary="API root info")
async def root() -> dict:
    return {
        "name": "Cortex Backend",
        "status": "redesign_mode",
        "database": "removed",
        "api": "connectivity_disabled",
    }


@app.get("/health", tags=["meta"], summary="Health check")
async def health() -> dict:
    return {
        "status": "ok",
        "mode": "redesign_baseline",
        "database": "removed",
        "services": {},
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENV == "development",
        log_level="info",
    )
