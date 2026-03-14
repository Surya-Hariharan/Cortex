"""
Cortex API — Comprehensive Endpoint Health Check
Tests all 80 API endpoints and prints a summary report.
"""
from __future__ import annotations

import io
import json
import sys
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

import requests

BASE = "http://127.0.0.1:8765/api/v1"
TIMEOUT = 10

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

results: List[Dict[str, Any]] = []

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
RESET  = "\033[0m"
BOLD   = "\033[1m"


def _tag(status: int, expected: List[int]) -> str:
    if status in expected:
        return f"{GREEN}PASS{RESET}"
    if status in (401, 403, 404, 422):
        return f"{YELLOW}WARN{RESET}"
    return f"{RED}FAIL{RESET}"


def hit(
    method: str,
    path: str,
    *,
    json_body: Optional[Dict] = None,
    params: Optional[Dict] = None,
    files: Optional[Dict] = None,
    expected: List[int] = None,
    label: Optional[str] = None,
    stream: bool = False,
) -> Tuple[int, Any]:
    if expected is None:
        expected = [200, 201, 202, 204]
    url = BASE + path
    tag_label = label or f"{method} {path}"
    try:
        r = requests.request(
            method,
            url,
            json=json_body,
            params=params,
            files=files,
            timeout=TIMEOUT,
            stream=stream,
        )
        status = r.status_code
        try:
            body = r.json() if not stream else {"stream": "SSE"}
        except Exception:
            body = r.text[:300]
        tag = _tag(status, expected)
        results.append({"label": tag_label, "status": status, "pass": status in expected, "body_snippet": str(body)[:120]})
        print(f"  {tag}  {method:<7} {path:<60} → {status}")
        return status, body
    except Exception as exc:
        results.append({"label": tag_label, "status": 0, "pass": False, "body_snippet": str(exc)})
        print(f"  {RED}ERR{RESET}  {method:<7} {path:<60} → {exc}")
        return 0, {}


# ---------------------------------------------------------------------------
# 1. Auth
# ---------------------------------------------------------------------------

print(f"\n{BOLD}── AUTH ────────────────────────────────────────────────────────────{RESET}")

# Use a stable test email so re-runs don't fail on register
TEST_EMAIL    = "healthcheck_cortex@example.com"
TEST_PASSWORD = "Cortex@Test1"
TEST_PHONE    = "9999999990"
USER_ID: str = ""

# Try register; 409 is fine (already exists)
s, body = hit("POST", "/auth/register", json_body={
    "name": "Health Check User",
    "email": TEST_EMAIL,
    "password": TEST_PASSWORD,
    "phone": TEST_PHONE,
    "gender": "Other",
    "location": "Test City",
    "college": "Test College",
    "degree": "B.Tech",
    "course": "CS",
    "user_type": "Student",
    "year_of_study": "2",
}, expected=[201, 409], label="POST /auth/register")

# Log in to get user_id
s2, body2 = hit("POST", "/auth/login", json_body={
    "email": TEST_EMAIL,
    "password": TEST_PASSWORD,
}, expected=[200])

if isinstance(body2, dict) and "id" in body2:
    USER_ID = body2["id"]
    print(f"  ℹ  Logged in as user_id={USER_ID[:8]}...")
else:
    print(f"  {RED}❌  Could not obtain user_id — downstream tests will be limited{RESET}")
    USER_ID = str(uuid.uuid4())

hit("POST", "/auth/forgot-password", json_body={"email": TEST_EMAIL}, expected=[200])
hit("POST", "/auth/reset-password", json_body={"token": "BADTOKEN", "new_password": "Cortex@Test1"},
    expected=[400, 422], label="POST /auth/reset-password (invalid token → expect 4xx)")

# ---------------------------------------------------------------------------
# 2. System
# ---------------------------------------------------------------------------

print(f"\n{BOLD}── SYSTEM ──────────────────────────────────────────────────────────{RESET}")

hit("GET",  "/system/health")
hit("GET",  "/system/models")
hit("GET",  "/system/scheduler")
hit("GET",  "/system/resources")
hit("GET",  "/system/mode")
hit("POST", "/system/internet-status", json_body={"online": True})
hit("POST", "/system/benchmark",       json_body={})
hit("POST", "/system/runtime",         json_body={"mode": "local"}, expected=[200, 422])
hit("POST", "/system/privacy",         json_body={"mode": "local"}, expected=[200, 422])
hit("POST", "/system/scheduler/pause")
hit("POST", "/system/scheduler/resume")
hit("POST", "/system/models/llm/load",   expected=[200, 202, 400, 404])
hit("POST", "/system/models/llm/unload", expected=[200, 202, 400, 404])

# ---------------------------------------------------------------------------
# 3. Activity
# ---------------------------------------------------------------------------

print(f"\n{BOLD}── ACTIVITY ────────────────────────────────────────────────────────{RESET}")

hit("GET", "/activity/stats", params={"user_id": USER_ID})
hit("GET", "/activity/chart", params={"user_id": USER_ID})
hit("GET", "/activity/feed",  params={"user_id": USER_ID})

# ---------------------------------------------------------------------------
# 4. Projects
# ---------------------------------------------------------------------------

print(f"\n{BOLD}── PROJECTS ────────────────────────────────────────────────────────{RESET}")

PROJECT_ID = ""
s, b = hit("POST", "/projects/", json_body={
    "user_id": USER_ID, "title": "Test Project", "description": "Auto-generated by health check", "color": "#6366f1"
}, expected=[201])
if isinstance(b, dict) and "id" in b:
    PROJECT_ID = b["id"]

hit("GET", "/projects/", params={"user_id": USER_ID})
if PROJECT_ID:
    hit("GET",   f"/projects/{PROJECT_ID}")
    hit("PATCH", f"/projects/{PROJECT_ID}", json_body={"title": "Test Project (updated)"})

# ---------------------------------------------------------------------------
# 5. Notes
# ---------------------------------------------------------------------------

print(f"\n{BOLD}── NOTES ───────────────────────────────────────────────────────────{RESET}")

NOTE_ID = ""
s, b = hit("POST", "/notes/", json_body={
    "user_id": USER_ID, "title": "Health Check Note", "content": "test content", "project_id": PROJECT_ID or None, "visibility": "public"
}, expected=[201])
if isinstance(b, dict) and "id" in b:
    NOTE_ID = b["id"]

hit("GET", "/notes/", params={"user_id": USER_ID})
if NOTE_ID:
    hit("GET",   f"/notes/{NOTE_ID}")
    hit("PATCH", f"/notes/{NOTE_ID}", json_body={"title": "Updated Note"})
    hit("PATCH", f"/notes/{NOTE_ID}/visibility", params={"user_id": USER_ID}, json_body={"visibility": "public"}, expected=[200])

hit("GET", "/notes/public/browse")
if NOTE_ID:
    hit("GET", f"/notes/shared/{NOTE_ID}", expected=[200, 404])  # might 404 if not published via share

# Save a public note to personal (self-save is fine for health check)
if NOTE_ID:
    hit("POST", f"/notes/{NOTE_ID}/save", params={"saver_id": USER_ID}, expected=[201, 400, 409])

# ---------------------------------------------------------------------------
# 6. Tasks
# ---------------------------------------------------------------------------

print(f"\n{BOLD}── TASKS ───────────────────────────────────────────────────────────{RESET}")

TASK_ID = ""
s, b = hit("POST", "/tasks/", json_body={
    "user_id": USER_ID, "title": "Health Check Task", "description": "Auto", "priority": "high", "project_id": PROJECT_ID or None
}, expected=[201])
if isinstance(b, dict) and "id" in b:
    TASK_ID = b["id"]

hit("GET", "/tasks/", params={"user_id": USER_ID})
if TASK_ID:
    hit("GET",   f"/tasks/{TASK_ID}")
    hit("PATCH", f"/tasks/{TASK_ID}", json_body={"status": "done"})

# ---------------------------------------------------------------------------
# 7. Chats
# ---------------------------------------------------------------------------

print(f"\n{BOLD}── CHATS ───────────────────────────────────────────────────────────{RESET}")

CHAT_ID = ""
s, b = hit("POST", "/chats/", json_body={
    "user_id": USER_ID, "title": "Health Check Chat", "model": "phi-3-mini"
}, expected=[201])
if isinstance(b, dict) and "id" in b:
    CHAT_ID = b["id"]

hit("GET", "/chats/", params={"user_id": USER_ID})
if CHAT_ID:
    hit("GET", f"/chats/{CHAT_ID}")
    hit("GET", f"/chats/{CHAT_ID}/messages")

# Streaming chat — just check it connects and returns 200 with SSE
hit("POST", "/chat", json_body={
    "user_id": USER_ID, "query": "Hello", "top_k": 3
}, expected=[200], stream=True, label="POST /chat (streaming RAG)")

# ---------------------------------------------------------------------------
# 8. Groups
# ---------------------------------------------------------------------------

print(f"\n{BOLD}── GROUPS ──────────────────────────────────────────────────────────{RESET}")

GROUP_ID = ""
INVITE_CODE = ""
s, b = hit("POST", "/groups/", json_body={
    "name": "Health Check Group", "description": "Auto", "creator_id": USER_ID, "creator_name": "Health Check User"
}, expected=[201])
if isinstance(b, dict) and "id" in b:
    GROUP_ID = b["id"]
    INVITE_CODE = b.get("invite_code", "")

hit("GET", "/groups/", params={"user_id": USER_ID})
if GROUP_ID:
    hit("GET", f"/groups/{GROUP_ID}")
    hit("GET", f"/groups/{GROUP_ID}/messages")
    hit("POST", f"/groups/{GROUP_ID}/messages", json_body={
        "sender_id": USER_ID, "sender_name": "Health Check User", "content": "Hello!", "channel": "general"
    }, expected=[201])
    hit("PATCH", f"/groups/{GROUP_ID}/settings", params={"admin_id": USER_ID},
        json_body={"name": "Updated Group"})

if INVITE_CODE:
    # Join with a real second user so FK validation does not invalidate the test.
    second_email = f"healthcheck_group_{uuid.uuid4().hex[:8]}@example.com"
    second_phone = f"77{uuid.uuid4().int % 10**8:08d}"
    hit("POST", "/auth/register", json_body={
        "name": "Health Check Group User",
        "email": second_email,
        "password": TEST_PASSWORD,
        "phone": second_phone,
        "gender": "",
        "location": "",
        "college": "",
        "degree": "",
        "course": "",
        "user_type": "Student",
        "year_of_study": "",
    }, expected=[201])
    _, second_login = hit("POST", "/auth/login", json_body={
        "email": second_email,
        "password": TEST_PASSWORD,
    }, expected=[200])
    second_user_id = second_login.get("id") if isinstance(second_login, dict) else None
    if second_user_id:
        hit("POST", "/groups/join", params={"invite_code": INVITE_CODE, "user_id": second_user_id, "user_name": "Health Check Group User"}, expected=[200])
    if GROUP_ID:
        hit("DELETE", f"/groups/{GROUP_ID}/leave", params={"user_id": second_user_id}, expected=[204])

# block/remove member (use own id to test API routing — will 403 since non-admin)
if GROUP_ID:
    DUMMY_MEMBER = str(uuid.uuid4())
    hit("PATCH",  f"/groups/{GROUP_ID}/members/{DUMMY_MEMBER}/block",  params={"admin_id": USER_ID}, expected=[200, 403, 404])
    hit("DELETE", f"/groups/{GROUP_ID}/members/{DUMMY_MEMBER}",        params={"admin_id": USER_ID}, expected=[204, 403, 404])

# ---------------------------------------------------------------------------
# 9. Notifications
# ---------------------------------------------------------------------------

print(f"\n{BOLD}── NOTIFICATIONS ───────────────────────────────────────────────────{RESET}")

NOTIF_ID = ""
hit("GET", "/notifications", params={"user_id": USER_ID})
s, b = hit("POST", "/notifications", params={"user_id": USER_ID}, json_body={
    "type": "system", "title": "Test Notif", "description": "Health check notification"
}, expected=[200])
if isinstance(b, dict) and "id" in b:
    NOTIF_ID = b["id"]

if NOTIF_ID:
    hit("PATCH", f"/notifications/{NOTIF_ID}/read", params={"user_id": USER_ID})
hit("PATCH", "/notifications/read-all", params={"user_id": USER_ID})
if NOTIF_ID:
    hit("DELETE", f"/notifications/{NOTIF_ID}", params={"user_id": USER_ID})
hit("DELETE", "/notifications", params={"user_id": USER_ID})

# ---------------------------------------------------------------------------
# 10. Engagement
# ---------------------------------------------------------------------------

print(f"\n{BOLD}── ENGAGEMENT ──────────────────────────────────────────────────────{RESET}")

DOC_ENTITY_ID = NOTE_ID or str(uuid.uuid4())
hit("POST", "/engagement/view", json_body={
    "viewer_id": USER_ID, "owner_id": USER_ID, "entity_type": "note", "entity_id": DOC_ENTITY_ID
})
hit("POST", "/engagement/download", json_body={
    "downloader_id": USER_ID, "owner_id": USER_ID, "entity_type": "note", "entity_id": DOC_ENTITY_ID
})
hit("POST", "/engagement/rate", json_body={
    "rater_id": USER_ID, "owner_id": USER_ID, "entity_type": "note", "entity_id": DOC_ENTITY_ID, "score": 5
})
hit("GET", f"/engagement/stats/note/{DOC_ENTITY_ID}")

# ---------------------------------------------------------------------------
# 11. Sync
# ---------------------------------------------------------------------------

print(f"\n{BOLD}── SYNC ────────────────────────────────────────────────────────────{RESET}")

hit("GET",  "/sync/status")
hit("GET",  "/sync/pull", params={"device_id": "health-check-device"})
hit("POST", "/sync/push", json_body={"events": []})

# ---------------------------------------------------------------------------
# 12. Mesh
# ---------------------------------------------------------------------------

print(f"\n{BOLD}── MESH ────────────────────────────────────────────────────────────{RESET}")

hit("GET",  "/mesh/peers")
hit("POST", "/mesh/sync", json_body={"target_peer_id": "peer-health-check", "entity_types": ["document"]})

# ---------------------------------------------------------------------------
# 13. Search
# ---------------------------------------------------------------------------

print(f"\n{BOLD}── SEARCH ──────────────────────────────────────────────────────────{RESET}")

hit("POST", "/search/", json_body={"user_id": USER_ID, "query": "test"})

# ---------------------------------------------------------------------------
# 14. RAG
# ---------------------------------------------------------------------------

print(f"\n{BOLD}── RAG ─────────────────────────────────────────────────────────────{RESET}")

hit("POST", "/rag/query", json_body={"user_id": USER_ID, "query": "What is Cortex?"}, expected=[200])

# ---------------------------------------------------------------------------
# 15. Documents (upload requires multipart; test list/get only with a dummy id)
# ---------------------------------------------------------------------------

print(f"\n{BOLD}── DOCUMENTS ───────────────────────────────────────────────────────{RESET}")

# Upload a tiny text file
dummy_bytes = b"Health check document content."
hit("POST", "/documents/upload",
    files={"file": ("health_check.txt", io.BytesIO(dummy_bytes), "text/plain")},
    params={"user_id": USER_ID, "title": "Health Check Doc"},
    expected=[201, 422],
    label="POST /documents/upload")

DOC_ID = ""
s, b = hit("GET", "/documents/", params={"user_id": USER_ID})
if isinstance(b, list) and b:
    DOC_ID = b[0]["id"]

if DOC_ID:
    hit("GET",   f"/documents/{DOC_ID}")
    hit("PATCH", f"/documents/{DOC_ID}", json_body={"title": "Updated Doc"})
    hit("POST",  f"/documents/{DOC_ID}/ingest", expected=[202])

# ---------------------------------------------------------------------------
# 16. Transcription (requires audio — send empty bytes expecting 422)
# ---------------------------------------------------------------------------

print(f"\n{BOLD}── TRANSCRIPTION ───────────────────────────────────────────────────{RESET}")

hit("POST", "/transcription/",
    files={"file": ("test.wav", io.BytesIO(b"RIFF...."), "audio/wav")},
    expected=[200, 422, 500],
    label="POST /transcription/ (dummy audio → expect 422/500)")

# ---------------------------------------------------------------------------
# 17. Cleanup — delete created entities
# ---------------------------------------------------------------------------

print(f"\n{BOLD}── CLEANUP ─────────────────────────────────────────────────────────{RESET}")

if CHAT_ID:
    hit("DELETE", f"/chats/{CHAT_ID}", expected=[204])
if TASK_ID:
    hit("DELETE", f"/tasks/{TASK_ID}", expected=[204])
if NOTE_ID:
    hit("DELETE", f"/notes/{NOTE_ID}", expected=[204])
if GROUP_ID:
    hit("DELETE", f"/groups/{GROUP_ID}", params={"user_id": USER_ID}, expected=[204])
if PROJECT_ID:
    hit("DELETE", f"/projects/{PROJECT_ID}", expected=[204])

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

total  = len(results)
passed = sum(1 for r in results if r["pass"])
warned = sum(1 for r in results if not r["pass"] and r["status"] in (400, 401, 403, 404, 422))
failed = total - passed - warned

print(f"\n{'='*70}")
print(f"{BOLD}  RESULTS:  {GREEN}{passed} PASS{RESET}  |  {YELLOW}{warned} WARN{RESET}  |  {RED}{failed} FAIL{RESET}  |  {total} total{RESET}")
print(f"{'='*70}")

if warned or failed:
    print(f"\n{BOLD}Issues:{RESET}")
    for r in results:
        if not r["pass"]:
            colour = YELLOW if r["status"] in (400, 401, 403, 404, 422) else RED
            cat    = "WARN" if r["status"] in (400, 401, 403, 404, 422) else "FAIL"
            print(f"  {colour}{cat}{RESET}  [{r['status']}]  {r['label']}")
            print(f"       {r['body_snippet']}")

sys.exit(0 if failed == 0 else 1)
