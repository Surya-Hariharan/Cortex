"""Document service — CRUD + async ingestion trigger."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.domain.document import Document, DocumentChunk
from app.models.schemas.document import DocumentCreate, DocumentUpdate, DocumentRead
from app.core.logging import get_logger

logger = get_logger(__name__)


async def create_document(data: DocumentCreate, db: AsyncSession) -> Document:
    doc = Document(
        id=str(uuid.uuid4()),
        **data.model_dump(),
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    logger.info("Document created", id=doc.id, filename=doc.filename)
    return doc


async def get_document(doc_id: str, db: AsyncSession) -> Optional[Document]:
    stmt = select(Document).where(Document.id == doc_id, Document.deleted_at.is_(None))
    return (await db.execute(stmt)).scalar_one_or_none()


async def list_documents(
    user_id: str,
    db: AsyncSession,
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Document]:
    filters = [Document.user_id == user_id, Document.deleted_at.is_(None)]
    if project_id:
        filters.append(Document.project_id == project_id)
    if status:
        filters.append(Document.status == status)
    stmt = select(Document).where(and_(*filters)).limit(limit).offset(offset)
    return list((await db.execute(stmt)).scalars().all())


async def update_document(doc_id: str, data: DocumentUpdate, db: AsyncSession) -> Optional[Document]:
    doc = await get_document(doc_id, db)
    if not doc:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(doc, field, value)
    doc.updated_at = datetime.utcnow()
    doc.version += 1
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


async def delete_document(doc_id: str, db: AsyncSession) -> bool:
    doc = await get_document(doc_id, db)
    if not doc:
        return False
    doc.deleted_at = datetime.utcnow()
    doc.status = "deleted"
    db.add(doc)
    await db.commit()
    return True


async def trigger_ingestion(doc_id: str) -> None:
    """Background ingestion task — creates its own DB session so it works
    correctly when called from FastAPI BackgroundTasks (after response is sent).
    """
    from app.ingestion.pipeline import ingest_document
    from app.database.connection import get_db_context

    try:
        async with get_db_context() as db:
            await ingest_document(doc_id, db)
    except Exception as exc:
        logger.error("Background ingestion error", id=doc_id, error=str(exc))
