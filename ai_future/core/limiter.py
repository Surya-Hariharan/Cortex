"""
Cortex — Rate Limiter
Singleton slowapi Limiter used across all auth endpoints to prevent
brute-force attacks, credential stuffing, and reset-spam abuse.
"""
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from fastapi import Request
from fastapi.responses import JSONResponse

limiter = Limiter(key_func=get_remote_address, default_limits=[])


def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Return a clean 429 JSON response instead of slowapi's default HTML."""
    return JSONResponse(
        status_code=429,
        content={
            "detail": (
                f"Too many requests. You have exceeded the rate limit "
                f"({exc.detail}). Please wait before trying again."
            )
        },
    )
