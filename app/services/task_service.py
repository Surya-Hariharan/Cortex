"""Task service — CRUD + status transitions."""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.domain.task import Task
from app.models.schemas.task import TaskCreate, TaskUpdate
from app.core.logging import get_logger

logger = get_logger(__name__)

VALID_STATUSES = {"todo", "in_progress", "done", "cancelled"}


async def create_task(data: TaskCreate, db: AsyncSession) -> Task:
    payload = data.model_dump()
    tags = payload.pop("tags", None)
    task = Task(
        id=str(uuid.uuid4()),
        tags=json.dumps(tags) if tags else None,
        **payload,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


async def get_task(task_id: str, db: AsyncSession) -> Optional[Task]:
    stmt = select(Task).where(Task.id == task_id, Task.deleted_at.is_(None))
    return (await db.execute(stmt)).scalar_one_or_none()


async def list_tasks(
    user_id: str,
    db: AsyncSession,
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Task]:
    filters = [Task.user_id == user_id, Task.deleted_at.is_(None)]
    if project_id:
        filters.append(Task.project_id == project_id)
    if status:
        filters.append(Task.status == status)
    stmt = select(Task).where(and_(*filters)).limit(limit).offset(offset)
    return list((await db.execute(stmt)).scalars().all())


async def update_task(task_id: str, data: TaskUpdate, db: AsyncSession) -> Optional[Task]:
    task = await get_task(task_id, db)
    if not task:
        return None
    payload = data.model_dump(exclude_none=True)
    if "tags" in payload:
        payload["tags"] = json.dumps(payload["tags"])
    # Auto-set completed_at when transitioning to done
    if payload.get("status") == "done" and task.status != "done":
        payload.setdefault("completed_at", datetime.utcnow())
    for field, value in payload.items():
        setattr(task, field, value)
    task.updated_at = datetime.utcnow()
    task.version += 1
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


async def delete_task(task_id: str, db: AsyncSession) -> bool:
    task = await get_task(task_id, db)
    if not task:
        return False
    task.deleted_at = datetime.utcnow()
    db.add(task)
    await db.commit()
    return True
