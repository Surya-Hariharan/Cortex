"""Tasks CRUD endpoint."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.services.task_service import (
    create_task, get_task, list_tasks, update_task, delete_task,
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.post("/", response_model=TaskRead, status_code=201)
async def create(data: TaskCreate, db: AsyncSession = Depends(get_db)) -> TaskRead:
    t = await create_task(data, db)
    return TaskRead.model_validate(t)


@router.get("/", response_model=List[TaskRead])
async def list_all(
    user_id: str,
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
) -> List[TaskRead]:
    tasks = await list_tasks(user_id, db, project_id=project_id, status=status, limit=limit, offset=offset)
    return [TaskRead.model_validate(t) for t in tasks]


@router.get("/{task_id}", response_model=TaskRead)
async def get_one(task_id: str, db: AsyncSession = Depends(get_db)) -> TaskRead:
    t = await get_task(task_id, db)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskRead.model_validate(t)


@router.patch("/{task_id}", response_model=TaskRead)
async def update(task_id: str, data: TaskUpdate, db: AsyncSession = Depends(get_db)) -> TaskRead:
    t = await update_task(task_id, data, db)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskRead.model_validate(t)


@router.delete("/{task_id}", status_code=204)
async def delete(task_id: str, db: AsyncSession = Depends(get_db)) -> None:
    ok = await delete_task(task_id, db)
    if not ok:
        raise HTTPException(status_code=404, detail="Task not found")
