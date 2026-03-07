"""Mesh network message protocol definitions."""
from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional


class MessageType(str, Enum):
    HELLO = "hello"          # Announce presence
    BYE = "bye"              # Graceful disconnect
    PING = "ping"
    PONG = "pong"
    SYNC_REQUEST = "sync_request"   # Request events since timestamp
    SYNC_RESPONSE = "sync_response" # Events payload
    SYNC_ACK = "sync_ack"           # Acknowledge receipt
    ERROR = "error"


@dataclass
class MeshMessage:
    type: MessageType
    sender_id: str                          # device_id of sender
    payload: Dict[str, Any] = field(default_factory=dict)
    message_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_json(self) -> str:
        return json.dumps(
            {
                "type": self.type.value,
                "sender_id": self.sender_id,
                "payload": self.payload,
                "message_id": self.message_id,
                "timestamp": self.timestamp,
            }
        )

    @classmethod
    def from_json(cls, data: str | bytes) -> "MeshMessage":
        obj = json.loads(data)
        return cls(
            type=MessageType(obj["type"]),
            sender_id=obj["sender_id"],
            payload=obj.get("payload", {}),
            message_id=obj.get("message_id", str(uuid.uuid4())),
            timestamp=obj.get("timestamp", datetime.utcnow().isoformat()),
        )
