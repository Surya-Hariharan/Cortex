"""Notes service — CRUD + sharing."""
from __future__ import annotations

import copy
import json
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.domain.note import Note, NoteSave
from app.models.schemas.note import NoteCreate, NoteUpdate, NoteVisibility
from app.core.logging import get_logger

logger = get_logger(__name__)


# ── Personal CRUD ─────────────────────────────────────────────────────────────

async def create_note(data: NoteCreate, db: AsyncSession) -> Note:
    payload = data.model_dump()
    tags = payload.pop("tags", None)
    # Keep is_shared in sync with visibility for backwards compat
    visibility = payload.get("visibility", NoteVisibility.private)
    is_shared = 0 if visibility == NoteVisibility.private else 1
    note = Note(
        id=str(uuid.uuid4()),
        tags=json.dumps(tags) if tags is not None else None,
        is_shared=is_shared,
        **payload,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


async def get_note(note_id: str, db: AsyncSession) -> Optional[Note]:
    stmt = select(Note).where(Note.id == note_id, Note.deleted_at.is_(None))
    return (await db.execute(stmt)).scalar_one_or_none()


async def list_notes(
    user_id: str,
    db: AsyncSession,
    project_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Note]:
    filters = [Note.user_id == user_id, Note.deleted_at.is_(None)]
    if project_id:
        filters.append(Note.project_id == project_id)
    stmt = select(Note).where(and_(*filters)).limit(limit).offset(offset)
    return list((await db.execute(stmt)).scalars().all())


async def update_note(note_id: str, data: NoteUpdate, db: AsyncSession) -> Optional[Note]:
    note = await get_note(note_id, db)
    if not note:
        return None
    payload = data.model_dump(exclude_none=True)
    if "tags" in payload:
        payload["tags"] = json.dumps(payload["tags"])
    # Keep is_shared in sync when visibility changes
    if "visibility" in payload:
        payload["is_shared"] = 0 if payload["visibility"] == NoteVisibility.private else 1
    for field, value in payload.items():
        setattr(note, field, value)
    note.updated_at = datetime.utcnow()
    note.version += 1
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


async def delete_note(note_id: str, db: AsyncSession) -> bool:
    note = await get_note(note_id, db)
    if not note:
        return False
    note.deleted_at = datetime.utcnow()
    db.add(note)
    await db.commit()
    return True


# ── Sharing ───────────────────────────────────────────────────────────────────

async def share_note(
    note_id: str,
    user_id: str,
    visibility: NoteVisibility,
    db: AsyncSession,
) -> Optional[Note]:
    """Change a note's visibility level. Only the owner may do this."""
    note = await get_note(note_id, db)
    if not note or note.user_id != user_id:
        return None
    note.visibility = visibility.value
    note.is_shared = 0 if visibility == NoteVisibility.private else 1
    note.updated_at = datetime.utcnow()
    note.version += 1
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


async def list_public_notes(
    db: AsyncSession,
    limit: int = 50,
    offset: int = 0,
    tag: Optional[str] = None,
) -> List[Note]:
    """Return all notes with visibility='public' for community browsing."""
    filters = [
        Note.visibility == NoteVisibility.public.value,
        Note.deleted_at.is_(None),
    ]
    if tag:
        # tags stored as JSON array string; use LIKE for simple substring match
        filters.append(Note.tags.like(f'%"{tag}"%'))
    stmt = (
        select(Note)
        .where(and_(*filters))
        .order_by(Note.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list((await db.execute(stmt)).scalars().all())


async def get_note_by_id_public(
    note_id: str, db: AsyncSession
) -> Optional[Note]:
    """Fetch a link_only or public note by its ID (for shared-link access)."""
    stmt = select(Note).where(
        Note.id == note_id,
        Note.visibility.in_([NoteVisibility.link_only.value, NoteVisibility.public.value]),
        Note.deleted_at.is_(None),
    )
    return (await db.execute(stmt)).scalar_one_or_none()


# ── Save (download) a shared note ─────────────────────────────────────────────

async def save_note_to_personal(
    source_note_id: str,
    saver_id: str,
    db: AsyncSession,
) -> Optional[NoteSave]:
    """
    Create a private copy of a shared note in the saver's own collection.

    Returns the NoteSave record.  Returns None if:
      - the source note does not exist or is not publicly accessible
      - the saver already saved this note (idempotency check)
      - the saver IS the owner (no need to save your own note)
    """
    # Check source note is accessible
    source = await get_note_by_id_public(source_note_id, db)
    if not source:
        # Also allow saving public notes the caller owns (no-op guard below)
        source = await get_note(source_note_id, db)
        if not source or source.visibility == NoteVisibility.private.value:
            return None

    # Owner should not save their own note
    if source.user_id == saver_id:
        return None

    # Idempotency: return existing save record if present
    existing_stmt = select(NoteSave).where(
        NoteSave.saver_id == saver_id,
        NoteSave.source_note_id == source_note_id,
    )
    existing = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        return existing

    # Create a private copy of the note
    tags_raw = source.tags  # already a JSON string
    local_copy = Note(
        id=str(uuid.uuid4()),
        user_id=saver_id,
        project_id=None,
        title=source.title,
        content=source.content,
        tags=tags_raw,
        is_pinned=0,
        is_completed=0,
        is_shared=0,
        visibility=NoteVisibility.private.value,
        version=1,
    )
    db.add(local_copy)
    await db.flush()  # get the new ID without committing

    # Record the save provenance
    note_save = NoteSave(
        id=str(uuid.uuid4()),
        saver_id=saver_id,
        source_note_id=source_note_id,
        local_note_id=local_copy.id,
    )
    db.add(note_save)
    await db.commit()
    await db.refresh(note_save)
    return note_save

