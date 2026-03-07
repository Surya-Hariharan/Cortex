"""Projects CRUD endpoint."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.services.project_service import (
    create_project, get_project, list_projects, update_project, delete_project,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post("/", response_model=ProjectRead, status_code=201)
async def create(data: ProjectCreate, db: AsyncSession = Depends(get_db)) -> ProjectRead:
    p = await create_project(data, db)
    return ProjectRead.model_validate(p)


@router.get("/", response_model=List[ProjectRead])
async def list_all(user_id: str, limit: int = 50, offset: int = 0, db: AsyncSession = Depends(get_db)) -> List[ProjectRead]:
    projects = await list_projects(user_id, db, limit=limit, offset=offset)
    return [ProjectRead.model_validate(p) for p in projects]


@router.get("/{project_id}", response_model=ProjectRead)
async def get_one(project_id: str, db: AsyncSession = Depends(get_db)) -> ProjectRead:
    p = await get_project(project_id, db)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectRead.model_validate(p)


@router.patch("/{project_id}", response_model=ProjectRead)
async def update(project_id: str, data: ProjectUpdate, db: AsyncSession = Depends(get_db)) -> ProjectRead:
    p = await update_project(project_id, data, db)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectRead.model_validate(p)


@router.delete("/{project_id}", status_code=204)
async def delete(project_id: str, db: AsyncSession = Depends(get_db)) -> None:
    ok = await delete_project(project_id, db)
    if not ok:
        raise HTTPException(status_code=404, detail="Project not found")
