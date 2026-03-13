"""mDNS peer discovery using zeroconf.

Registers this device as a Cortex peer and discovers other peers on the
local network via DNS-SD / mDNS.

Usage::

    from app.mesh_network.peer_discovery import PeerDiscovery
    discovery = PeerDiscovery(device_id="my-device", display_name="Alice's MacBook")
    await discovery.start()
    peers = discovery.get_peers()
    await discovery.stop()
"""
from __future__ import annotations

import asyncio
import socket
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from app.core.config import settings
from app.core.logging import get_logger
from app.models.schemas.mesh import PeerInfo

logger = get_logger(__name__)

SERVICE_TYPE = "_cortex._tcp.local."


class PeerDiscovery:
    """mDNS-based peer discovery using zeroconf."""

    def __init__(
        self,
        device_id: str,
        display_name: str,
        port: int | None = None,
    ) -> None:
        self._device_id = device_id
        self._display_name = display_name
        self._port = port or settings.MESH_WS_PORT
        self._zeroconf = None
        self._service_info = None
        self._browser = None
        self._peers: Dict[str, PeerInfo] = {}
        self._peer_last_seen: Dict[str, datetime] = {}
        self._lock = threading.Lock()

    async def start(self) -> None:
        """Register service and start browsing for peers."""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._start_sync)
        logger.info("PeerDiscovery started", device_id=self._device_id, port=self._port)

    def _start_sync(self) -> None:
        try:
            from zeroconf import ServiceBrowser, ServiceInfo, Zeroconf  # type: ignore
        except ImportError as exc:
            logger.warning("zeroconf not installed — mesh discovery disabled")
            return

        local_ip = self._get_local_ip()
        self._zeroconf = Zeroconf()

        self._service_info = ServiceInfo(
            SERVICE_TYPE,
            name=f"{self._device_id}.{SERVICE_TYPE}",
            addresses=[socket.inet_aton(local_ip)],
            port=self._port,
            properties={
                b"device_id": self._device_id.encode(),
                b"display_name": self._display_name.encode(),
            },
        )
        self._zeroconf.register_service(self._service_info)

        self._browser = ServiceBrowser(self._zeroconf, SERVICE_TYPE, handlers=[self._on_service_state_change])

    def _on_service_state_change(self, zeroconf, service_type, name, state_change) -> None:
        try:
            from zeroconf import ServiceStateChange  # type: ignore
        except ImportError:
            return

        if state_change == ServiceStateChange.Added:
            try:
                info = zeroconf.get_service_info(service_type, name)
                if info:
                    device_id = info.properties.get(b"device_id", b"").decode()
                    display_name = info.properties.get(b"display_name", b"unknown").decode()
                    if device_id and device_id != self._device_id:
                        addr = socket.inet_ntoa(info.addresses[0]) if info.addresses else "unknown"
                        peer = PeerInfo(
                            peer_id=name,
                            device_id=device_id,
                            display_name=display_name,
                            ip_address=addr,
                            port=info.port,
                            last_seen=datetime.utcnow(),
                            is_connected=True,
                        )
                        with self._lock:
                            self._peers[device_id] = peer
                            self._peer_last_seen[device_id] = datetime.utcnow()
                        logger.info("Peer discovered", device_id=device_id, ip=addr)
            except Exception:
                # Handle NotRunningException or other errors during shutdown
                pass

        elif state_change == ServiceStateChange.Removed:
            # For removal, we don't strictly need get_service_info if we can extract id from name,
            # but we'll just handle the potential failure here.
            try:
                info = zeroconf.get_service_info(service_type, name)
                if info:
                    device_id = info.properties.get(b"device_id", b"").decode()
                    with self._lock:
                        self._peers.pop(device_id, None)
                    logger.info("Peer removed", device_id=device_id)
            except Exception:
                pass

    def get_peers(self) -> List[PeerInfo]:
        cutoff = datetime.utcnow() - timedelta(seconds=60)
        with self._lock:
            stale = [did for did, ts in self._peer_last_seen.items() if ts < cutoff]
            for did in stale:
                self._peers.pop(did, None)
                self._peer_last_seen.pop(did, None)
            return list(self._peers.values())

    def get_peer(self, device_id: str) -> Optional[PeerInfo]:
        with self._lock:
            return self._peers.get(device_id)

    async def stop(self) -> None:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._stop_sync)
        logger.info("PeerDiscovery stopped")

    def _stop_sync(self) -> None:
        if self._zeroconf:
            try:
                if self._service_info:
                    self._zeroconf.unregister_service(self._service_info)
                self._zeroconf.close()
            except Exception as e:
                logger.warning("Error stopping zeroconf", error=str(e))

    @staticmethod
    def _get_local_ip() -> str:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.connect(("8.8.8.8", 80))
                return s.getsockname()[0]
        except Exception:
            return "127.0.0.1"


# Global singleton (populated at startup with real device_id/name)
_discovery_instance: Optional[PeerDiscovery] = None


def get_discovery() -> Optional[PeerDiscovery]:
    return _discovery_instance


def init_discovery(device_id: str, display_name: str) -> PeerDiscovery:
    global _discovery_instance
    _discovery_instance = PeerDiscovery(device_id=device_id, display_name=display_name)
    return _discovery_instance
