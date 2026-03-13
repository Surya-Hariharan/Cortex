"""API v1 aggregate router."""
from fastapi import APIRouter

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.documents import router as documents_router
from app.api.v1.endpoints.search import router as search_router
from app.api.v1.endpoints.rag import router as rag_router
from app.api.v1.endpoints.transcription import router as transcription_router
from app.api.v1.endpoints.projects import router as projects_router
from app.api.v1.endpoints.notes import router as notes_router
from app.api.v1.endpoints.tasks import router as tasks_router
from app.api.v1.endpoints.chats import router as chats_router
from app.api.v1.endpoints.mesh import router as mesh_router
from app.api.v1.endpoints.sync import router as sync_router
from app.api.v1.endpoints.system import router as system_router
from app.api.v1.endpoints.groups import router as groups_router
from app.api.v1.endpoints.activity import router as activity_router
from app.api.v1.endpoints.notifications import router as notifications_router
from app.api.v1.endpoints.engagement import router as engagement_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(documents_router)
api_router.include_router(search_router)
api_router.include_router(rag_router)
api_router.include_router(transcription_router)
api_router.include_router(projects_router)
api_router.include_router(notes_router)
api_router.include_router(tasks_router)
api_router.include_router(chats_router)
api_router.include_router(mesh_router)
api_router.include_router(sync_router)
api_router.include_router(system_router)
api_router.include_router(groups_router)
api_router.include_router(activity_router)
api_router.include_router(notifications_router)
api_router.include_router(engagement_router)

