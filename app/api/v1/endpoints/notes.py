"""Notes CRUD endpoint."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.schemas.note import NoteCreate, NoteRead, NoteUpdate
from app.services.notes_service import (
    create_note, get_note, list_notes, update_note, delete_note,
)

router = APIRouter(prefix="/notes", tags=["Notes"])


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
