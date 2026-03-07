"""Secure peer identity — Ed25519 keypair generation, message signing, and
signature verification for the Cortex mesh network.

Each node generates a persistent Ed25519 keypair on first run.  Keys are
stored in ``data/identity/`` as PEM files.  Trusted peer public keys are
stored in ``data/identity/trusted_peers.json``.

Usage::

    from app.mesh_network.peer_identity import identity

    # Sign an outgoing message
    signed_payload = identity.sign_message(msg.to_json())

    # Verify an incoming message (raises ValueError if bad/unknown)
    identity.verify_message(raw_bytes, sender_peer_id)

    # Explicitly trust a peer
    identity.trust_peer(peer_id, public_key_b64)

Security properties
───────────────────
- Ed25519 signatures are deterministic and non-malleable.
- A 32-byte public key is included in every signed message frame alongside the
  64-byte signature.
- Unknown peers are rejected by default unless ``MESH_TRUST_ALL=true`` is set
  in .env (useful for LAN-only development use).
"""
from __future__ import annotations

import base64
import json
import os
from pathlib import Path
from typing import Dict, Optional

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_IDENTITY_DIR = Path(settings.DATA_DIR) / "identity"
_PRIVATE_KEY_FILE = _IDENTITY_DIR / "node_private.pem"
_PUBLIC_KEY_FILE = _IDENTITY_DIR / "node_public.pem"
_TRUSTED_PEERS_FILE = _IDENTITY_DIR / "trusted_peers.json"

# Set MESH_TRUST_ALL=true in .env to allow any peer (dev mode only)
_TRUST_ALL: bool = os.environ.get("MESH_TRUST_ALL", "false").lower() == "true"


def _load_cryptography():
    """Lazily import cryptography package — raises RuntimeError if absent."""
    try:
        from cryptography.hazmat.primitives.asymmetric.ed25519 import (  # type: ignore
            Ed25519PrivateKey,
            Ed25519PublicKey,
        )
        from cryptography.hazmat.primitives.serialization import (
            Encoding,
            PrivateFormat,
            PublicFormat,
            NoEncryption,
            load_pem_private_key,
            load_pem_public_key,
        )
        from cryptography.exceptions import InvalidSignature  # type: ignore

        return (
            Ed25519PrivateKey,
            Ed25519PublicKey,
            Encoding,
            PrivateFormat,
            PublicFormat,
            NoEncryption,
            load_pem_private_key,
            load_pem_public_key,
            InvalidSignature,
        )
    except ImportError as exc:
        raise RuntimeError(
            "The 'cryptography' package is required for mesh peer identity. "
            "Install it with: pip install cryptography"
        ) from exc


class NodeIdentity:
    """Manages the local node's Ed25519 keypair and trusted peer registry."""

    def __init__(self) -> None:
        self._private_key = None
        self._public_key = None
        self._trusted: Dict[str, bytes] = {}  # peer_id → raw public key bytes
        self._loaded = False

    def _ensure_loaded(self) -> None:
        if self._loaded:
            return
        _IDENTITY_DIR.mkdir(parents=True, exist_ok=True)
        self._private_key, self._public_key = self._load_or_generate_keypair()
        self._load_trusted_peers()
        self._loaded = True

    def _load_or_generate_keypair(self):
        (
            Ed25519PrivateKey, _, Encoding,
            PrivateFormat, PublicFormat, NoEncryption,
            load_pem_private_key, load_pem_public_key, _,
        ) = _load_cryptography()

        if _PRIVATE_KEY_FILE.exists() and _PUBLIC_KEY_FILE.exists():
            priv = load_pem_private_key(_PRIVATE_KEY_FILE.read_bytes(), password=None)
            pub = load_pem_public_key(_PUBLIC_KEY_FILE.read_bytes())
            logger.info("NodeIdentity loaded existing keypair")
            return priv, pub

        # Generate fresh keypair
        priv = Ed25519PrivateKey.generate()
        pub = priv.public_key()
        _PRIVATE_KEY_FILE.write_bytes(
            priv.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())
        )
        _PUBLIC_KEY_FILE.write_bytes(
            pub.public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo)
        )
        # Lock down permissions on the private key file
        try:
            os.chmod(_PRIVATE_KEY_FILE, 0o600)
        except OSError:
            pass
        logger.info("NodeIdentity generated new Ed25519 keypair")
        return priv, pub

    def _load_trusted_peers(self) -> None:
        if not _TRUSTED_PEERS_FILE.exists():
            return
        try:
            data = json.loads(_TRUSTED_PEERS_FILE.read_text())
            (_, _, _, _, _, _, _, load_pem_public_key, _) = _load_cryptography()
            from cryptography.hazmat.primitives.serialization import load_der_public_key  # type: ignore
            for peer_id, pub_b64 in data.items():
                raw = base64.b64decode(pub_b64)
                self._trusted[peer_id] = raw
        except Exception as exc:
            logger.warning("Failed to load trusted peers", error=str(exc))

    def _save_trusted_peers(self) -> None:
        try:
            serialised = {pid: base64.b64encode(raw).decode() for pid, raw in self._trusted.items()}
            _TRUSTED_PEERS_FILE.write_text(json.dumps(serialised, indent=2))
        except Exception as exc:
            logger.warning("Failed to save trusted peers", error=str(exc))

    @property
    def public_key_b64(self) -> str:
        """Base64-encoded raw public key bytes for sharing with peers."""
        self._ensure_loaded()
        (_, _, Encoding, _, PublicFormat, _, _, _, _) = _load_cryptography()
        raw = self._public_key.public_bytes(Encoding.Raw, PublicFormat.Raw)
        return base64.b64encode(raw).decode()

    def sign_message(self, message: str | bytes) -> dict:
        """Sign ``message`` and return a dict with ``payload``, ``signature``,
        and ``public_key`` fields ready to embed in a MeshMessage payload."""
        self._ensure_loaded()
        if isinstance(message, str):
            message = message.encode()
        sig = self._private_key.sign(message)
        return {
            "payload": base64.b64encode(message).decode(),
            "signature": base64.b64encode(sig).decode(),
            "public_key": self.public_key_b64,
        }

    def verify_message(
        self,
        raw_message: str | bytes,
        signature_b64: str,
        sender_peer_id: str,
        sender_pub_key_b64: Optional[str] = None,
    ) -> None:
        """Verify ``raw_message`` against ``signature_b64``.

        Raises ``ValueError`` if:
          - Peer is unknown and trust-all is disabled.
          - Signature doesn't match.
          - Any cryptographic error occurs.
        """
        self._ensure_loaded()
        (
            _, Ed25519PublicKey, Encoding, _, PublicFormat, _, _, load_pem_public_key,
            InvalidSignature,
        ) = _load_cryptography()
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey as _PK  # type: ignore

        if isinstance(raw_message, str):
            raw_message = raw_message.encode()

        # Resolve public key for this peer
        if sender_peer_id in self._trusted:
            raw_pub = self._trusted[sender_peer_id]
        elif sender_pub_key_b64:
            if not _TRUST_ALL:
                raise ValueError(
                    f"Peer '{sender_peer_id}' is not in the trusted registry. "
                    "Call identity.trust_peer() to explicitly allow this peer."
                )
            raw_pub = base64.b64decode(sender_pub_key_b64)
        else:
            raise ValueError(
                f"No public key available for peer '{sender_peer_id}'."
            )

        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey as _Ed  # type: ignore
        pub_key = _Ed.from_public_bytes(raw_pub)
        sig_bytes = base64.b64decode(signature_b64)
        try:
            pub_key.verify(sig_bytes, raw_message)
        except InvalidSignature as exc:
            raise ValueError(f"Invalid signature from peer '{sender_peer_id}'") from exc

    def trust_peer(self, peer_id: str, public_key_b64: str) -> None:
        """Add a peer to the trusted registry."""
        self._ensure_loaded()
        raw = base64.b64decode(public_key_b64)
        self._trusted[peer_id] = raw
        self._save_trusted_peers()
        logger.info("Peer trusted", peer_id=peer_id)

    def revoke_peer(self, peer_id: str) -> bool:
        """Remove a peer from the trusted registry.  Returns True if it existed."""
        self._ensure_loaded()
        removed = self._trusted.pop(peer_id, None)
        if removed is not None:
            self._save_trusted_peers()
            logger.info("Peer revoked", peer_id=peer_id)
            return True
        return False

    def is_trusted(self, peer_id: str) -> bool:
        self._ensure_loaded()
        return _TRUST_ALL or peer_id in self._trusted

    def list_trusted_peers(self) -> list[str]:
        self._ensure_loaded()
        return list(self._trusted.keys())


# Global singleton — lazy initialised on first property access
identity = NodeIdentity()
