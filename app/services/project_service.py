"""Project service — CRUD."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.domain.project import Project
from app.models.schemas.project import ProjectCreate, ProjectUpdate
from app.core.logging import get_logger

logger = get_logger(__name__)


async def create_project(data: ProjectCreate, db: AsyncSession) -> Project:
    project = Project(id=str(uuid.uuid4()), **data.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def get_project(project_id: str, db: AsyncSession) -> Optional[Project]:
    stmt = select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
    return (await db.execute(stmt)).scalar_one_or_none()


async def list_projects(user_id: str, db: AsyncSession, limit: int = 50, offset: int = 0) -> List[Project]:
    stmt = (
        select(Project)
        .where(Project.user_id == user_id, Project.deleted_at.is_(None))
        .limit(limit)
        .offset(offset)
    )
    return list((await db.execute(stmt)).scalars().all())


async def update_project(project_id: str, data: ProjectUpdate, db: AsyncSession) -> Optional[Project]:
    project = await get_project(project_id, db)
    if not project:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(project, field, value)
    project.updated_at = datetime.utcnow()
    project.version += 1
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def delete_project(project_id: str, db: AsyncSession) -> bool:
    project = await get_project(project_id, db)
    if not project:
        return False
    project.deleted_at = datetime.utcnow()
    db.add(project)
    await db.commit()
    return True
