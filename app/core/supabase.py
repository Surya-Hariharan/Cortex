"""
Cortex — Supabase client factory.

Provides a lazy singleton for the anon client (used by auth and frontend-facing
operations) and an optional admin client using the service_role key (server-only,
bypasses RLS — only created when the key is configured).

Usage::

    from app.core.supabase import get_supabase, get_supabase_admin
    client = get_supabase()
    admin  = get_supabase_admin()   # may be None if service_role key not set
"""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)


@lru_cache(maxsize=1)
def get_supabase():
    """Return the singleton anon Supabase client.

    Returns None and logs a warning if SUPABASE_URL / SUPABASE_ANON_KEY are not
    configured — callers should guard against None so the app still runs fully
    offline without Supabase credentials.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        log.warning("supabase.not_configured", hint="Set SUPABASE_URL and SUPABASE_ANON_KEY in .env")
        return None
    try:
        from supabase import create_client, Client  # type: ignore
        client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
        log.info("supabase.client_ready", url=settings.SUPABASE_URL)
        return client
    except ImportError:
        log.warning("supabase.missing_package", hint="pip install supabase")
        return None


@lru_cache(maxsize=1)
def get_supabase_admin():
    """Return the singleton admin Supabase client (service_role key).

    Returns None when the service_role key is not set.
    Only for server-side operations that need to bypass RLS.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        return None
    try:
        from supabase import create_client, Client  # type: ignore
        client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
        log.info("supabase.admin_client_ready")
        return client
    except ImportError:
        log.warning("supabase.missing_package", hint="pip install supabase")
        return None
