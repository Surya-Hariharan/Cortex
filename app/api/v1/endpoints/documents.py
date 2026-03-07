"""Documents API — upload, list, retrieve, delete, trigger ingestion."""
from __future__ import annotations

import os
import uuid
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.schemas.document import DocumentCreate, DocumentRead, DocumentUpdate
from app.services.document_service import (
    create_document, get_document, list_documents, update_document,
    delete_document, trigger_ingestion,
)
from app.core.config import settings

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/upload", response_model=DocumentRead, status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    user_id: str = Form(...),
    project_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> DocumentRead:
    """Upload a document file and queue it for ingestion."""
    upload_dir = os.path.join(settings.DATA_DIR, "uploads", user_id)
    os.makedirs(upload_dir, exist_ok=True)

    safe_name = f"{uuid.uuid4()}_{file.filename}"
    dest_path = os.path.join(upload_dir, safe_name)

    content = await file.read()
    with open(dest_path, "wb") as f:
        f.write(content)

    data = DocumentCreate(
        user_id=user_id,
        project_id=project_id,
        filename=file.filename or safe_name,
        file_path=dest_path,
        file_size=len(content),
        mime_type=file.content_type or "application/pdf",
    )
    doc = await create_document(data, db)
    background_tasks.add_task(trigger_ingestion, doc.id, db)
    return DocumentRead.model_validate(doc)


@router.get("/", response_model=List[DocumentRead])
async def list_docs(
    user_id: str,
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
) -> List[DocumentRead]:
    docs = await list_documents(user_id, db, project_id=project_id, status=status, limit=limit, offset=offset)
    return [DocumentRead.model_validate(d) for d in docs]


@router.get("/{doc_id}", response_model=DocumentRead)
async def get_doc(doc_id: str, db: AsyncSession = Depends(get_db)) -> DocumentRead:
    doc = await get_document(doc_id, db)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentRead.model_validate(doc)


@router.patch("/{doc_id}", response_model=DocumentRead)
async def patch_doc(doc_id: str, data: DocumentUpdate, db: AsyncSession = Depends(get_db)) -> DocumentRead:
    doc = await update_document(doc_id, data, db)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentRead.model_validate(doc)


@router.delete("/{doc_id}", status_code=204)
async def remove_doc(doc_id: str, db: AsyncSession = Depends(get_db)) -> None:
    ok = await delete_document(doc_id, db)
    if not ok:
        raise HTTPException(status_code=404, detail="Document not found")


@router.post("/{doc_id}/ingest", status_code=202)
async def reindex_doc(
    doc_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict:
    doc = await get_document(doc_id, db)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    background_tasks.add_task(trigger_ingestion, doc_id, db)
    return {"status": "queued", "document_id": doc_id}
