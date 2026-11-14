"""Default (untagged) routes: health check, root redirect and favicon.

Untagged routes are listed under "default" in ``/docs``. Swagger lists groups in registration
order, so ``app/routes/__init__.py`` registers this router first to show "default" at the top.
"""

from __future__ import annotations

from fastapi import APIRouter, Response, status
from fastapi.responses import RedirectResponse

from app.config import get_settings

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    settings = get_settings()
    return {"status": "ok", "app": settings.app_name, "env": settings.app_env}


@router.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="/docs")


@router.get("/favicon.ico", include_in_schema=False)
def favicon() -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)
