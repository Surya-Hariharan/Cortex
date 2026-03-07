"""Notes CRUD + sharing endpoints."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.schemas.note import (
    NoteCreate, NoteRead, NoteUpdate,
    NoteVisibility, NoteSaveRead,
)
from app.services.notes_service import (
    create_note, get_note, list_notes, update_note, delete_note,
    share_note, list_public_notes, get_note_by_id_public, save_note_to_personal,
)

router = APIRouter(prefix="/notes", tags=["Notes"])


# ── Personal CRUD ─────────────────────────────────────────────────────────────

@router.post("/", response_model=NoteRead, status_code=201)
async def create(data: NoteCreate, db: AsyncSession = Depends(get_db)) -> NoteRead:
    n = await create_note(data, db)
    return NoteRead.model_validate(n)


@router.get("/", response_model=List[NoteRead])
async def list_all(
    user_id: str,
    project_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
) -> List[NoteRead]:
    notes = await list_notes(user_id, db, project_id=project_id, limit=limit, offset=offset)
    return [NoteRead.model_validate(n) for n in notes]


@router.get("/{note_id}", response_model=NoteRead)
async def get_one(note_id: str, db: AsyncSession = Depends(get_db)) -> NoteRead:
    n = await get_note(note_id, db)
    if not n:
        raise HTTPException(status_code=404, detail="Note not found")
    return NoteRead.model_validate(n)


@router.patch("/{note_id}", response_model=NoteRead)
async def update(note_id: str, data: NoteUpdate, db: AsyncSession = Depends(get_db)) -> NoteRead:
    n = await update_note(note_id, data, db)
    if not n:
        raise HTTPException(status_code=404, detail="Note not found")
    return NoteRead.model_validate(n)


@router.delete("/{note_id}", status_code=204)
async def delete(note_id: str, db: AsyncSession = Depends(get_db)) -> None:
    ok = await delete_note(note_id, db)
    if not ok:
        raise HTTPException(status_code=404, detail="Note not found")


# ── Sharing ───────────────────────────────────────────────────────────────────

@router.patch("/{note_id}/visibility", response_model=NoteRead)
async def set_visibility(
    note_id: str,
    user_id: str,
    visibility: NoteVisibility = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
) -> NoteRead:
    """Change a note's visibility (private / link_only / public). Owner only."""
    n = await share_note(note_id, user_id, visibility, db)
    if not n:
        raise HTTPException(status_code=404, detail="Note not found or not owned by user")
    return NoteRead.model_validate(n)


# ── Public browsing ───────────────────────────────────────────────────────────

@router.get("/public/browse", response_model=List[NoteRead])
async def browse_public(
    limit: int = 50,
    offset: int = 0,
    tag: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> List[NoteRead]:
    """List all publicly shared notes for community browsing."""
    notes = await list_public_notes(db, limit=limit, offset=offset, tag=tag)
    return [NoteRead.model_validate(n) for n in notes]


@router.get("/shared/{note_id}", response_model=NoteRead)
async def get_shared(note_id: str, db: AsyncSession = Depends(get_db)) -> NoteRead:
    """Fetch a link_only or public note by its UUID (shared-link access)."""
    n = await get_note_by_id_public(note_id, db)
    if not n:
        raise HTTPException(status_code=404, detail="Shared note not found")
    return NoteRead.model_validate(n)


# ── Save (download) ───────────────────────────────────────────────────────────

@router.post("/{note_id}/save", response_model=NoteSaveRead, status_code=201)
async def save_to_personal(
    note_id: str,
    saver_id: str,
    db: AsyncSession = Depends(get_db),
) -> NoteSaveRead:
    """
    Save a copy of someone else's shared note into the caller's personal collection.
    Creates a private Note copy and returns the provenance record.
    """
    record = await save_note_to_personal(note_id, saver_id, db)
    if not record:
        raise HTTPException(
            status_code=400,
            detail="Note is not publicly accessible, does not exist, or you already saved it",
        )
    return NoteSaveRead.model_validate(record)

