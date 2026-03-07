"""Notes service — CRUD."""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.domain.note import Note
from app.models.schemas.note import NoteCreate, NoteUpdate
from app.core.logging import get_logger

logger = get_logger(__name__)


async def create_note(data: NoteCreate, db: AsyncSession) -> Note:
    payload = data.model_dump()
    tags = payload.pop("tags", None)
    note = Note(
        id=str(uuid.uuid4()),
        tags=json.dumps(tags) if tags is not None else None,
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
