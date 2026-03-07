"""Sync manager — coordinates push/pull with optional cloud relay."""
from __future__ import annotations

import json
from datetime import datetime
from typing import List, Optional

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.models.schemas.sync import SyncEventCreate

logger = get_logger(__name__)


class SyncManager:
    """Coordinates event push to cloud relay and pull of remote events."""

    def __init__(self) -> None:
        self._base_url = (
            str(getattr(settings, "CLOUD_RELAY_URL", ""))
            or str(settings.SYNC_ENDPOINT)
        ).rstrip("/")

    def _relay_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if settings.SUPABASE_ANON_KEY:
            headers["apikey"] = settings.SUPABASE_ANON_KEY
            headers["Authorization"] = f"Bearer {settings.SUPABASE_ANON_KEY}"
        return headers

    async def push_events(self, events: List[SyncEventCreate]) -> bool:
        """Push a batch of local events to cloud relay.

        Returns True on success.
        """
        if not self._base_url:
            logger.debug("Cloud relay not configured, skipping push")
            return False
        try:
            payload = [e.model_dump() for e in events]
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{self._base_url}/sync/push",
                    json={"events": payload},
                    headers=self._relay_headers(),
                )
            resp.raise_for_status()
            logger.info("Events pushed to relay", count=len(events))
            return True
        except Exception as exc:
            logger.warning("Push failed", error=str(exc))
            return False

    async def pull_events(
        self, device_id: str, since: Optional[datetime] = None
    ) -> List[dict]:
        """Pull remote events from cloud relay since `since`.

        Returns list of raw event dicts.
        """
        if not self._base_url:
            return []
        params: dict = {"device_id": device_id}
        if since:
            params["since"] = since.isoformat()
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{self._base_url}/sync/pull",
                    params=params,
                    headers=self._relay_headers(),
                )
            resp.raise_for_status()
            data = resp.json()
            return data.get("events", [])
        except Exception as exc:
            logger.warning("Pull failed", error=str(exc))
            return []


# Global singleton
sync_manager = SyncManager()
