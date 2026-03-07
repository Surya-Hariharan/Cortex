"""Vector-clock based conflict resolver for CRDT-style merging.

Strategy:
  - "last writer wins" at field level, using vector clock timestamps.
  - Concurrent edits to same entity merge field-by-field; conflicting fields
    keep the version with the higher total clock sum.
"""
from __future__ import annotations

import json
from typing import Any, Dict, Tuple


VectorClock = Dict[str, int]


def increment(clock: VectorClock, device_id: str) -> VectorClock:
    new_clock = dict(clock)
    new_clock[device_id] = new_clock.get(device_id, 0) + 1
    return new_clock


def merge_clocks(a: VectorClock, b: VectorClock) -> VectorClock:
    """Component-wise maximum of two vector clocks."""
    keys = set(a) | set(b)
    return {k: max(a.get(k, 0), b.get(k, 0)) for k in keys}


def _clock_sum(clock: VectorClock) -> int:
    return sum(clock.values())


def dominates(a: VectorClock, b: VectorClock) -> bool:
    """Return True if clock `a` causally dominates `b`."""
    return all(a.get(k, 0) >= b.get(k, 0) for k in b) and any(
        a.get(k, 0) > b.get(k, 0) for k in b
    )


def resolve(
    local_payload: Dict[str, Any],
    local_clock: VectorClock,
    remote_payload: Dict[str, Any],
    remote_clock: VectorClock,
) -> Tuple[Dict[str, Any], VectorClock]:
    """Merge two concurrent payloads using LWW at field level.

    Returns:
        (merged_payload, merged_vector_clock)
    """
    if dominates(local_clock, remote_clock):
        return local_payload, local_clock
    if dominates(remote_clock, local_clock):
        return remote_payload, remote_clock

    # Concurrent — merge field by field using clock sum heuristic
    merged: Dict[str, Any] = {}
    all_keys = set(local_payload) | set(remote_payload)
    local_sum = _clock_sum(local_clock)
    remote_sum = _clock_sum(remote_clock)

    for key in all_keys:
        in_local = key in local_payload
        in_remote = key in remote_payload
        if in_local and not in_remote:
            merged[key] = local_payload[key]
        elif in_remote and not in_local:
            merged[key] = remote_payload[key]
        else:
            # Both have the field — pick higher clock sum (last writer)
            merged[key] = local_payload[key] if local_sum >= remote_sum else remote_payload[key]

    return merged, merge_clocks(local_clock, remote_clock)


def resolve_from_json(
    local_json: str,
    local_clock_json: str,
    remote_json: str,
    remote_clock_json: str,
) -> Tuple[str, str]:
    """Convenience wrapper that accepts / returns JSON strings."""
    merged_payload, merged_clock = resolve(
        json.loads(local_json),
        json.loads(local_clock_json),
        json.loads(remote_json),
        json.loads(remote_clock_json),
    )
    return json.dumps(merged_payload), json.dumps(merged_clock)
