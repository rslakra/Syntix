"""FastAPI routers — thin: validate input, call a service, shape the response."""

from fastapi import APIRouter

from app.routes import defaults, meetings, processing, qa

api_router = APIRouter()
# Registered first so the untagged "default" group is listed at the top of /docs.
api_router.include_router(defaults.router)
api_router.include_router(meetings.router)
api_router.include_router(processing.router)
api_router.include_router(qa.router)

__all__ = ["api_router"]
