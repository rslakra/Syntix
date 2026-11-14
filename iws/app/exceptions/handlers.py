from __future__ import annotations

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

from app.exceptions.base import AppError


def to_http_exception(exc: AppError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=str(exc))


async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    """Registered on the FastAPI app so services can simply ``raise NotFoundError(...)``."""
    return JSONResponse(status_code=exc.status_code, content={"detail": str(exc)})
