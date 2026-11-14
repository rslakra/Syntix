"""API entry point — ``python -m app.main`` or ``make start``."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db.session import configure_engine, init_database
from app.exceptions import AppError, app_error_handler
from app.routes import api_router
from app.services.factory import build_meeting_service

settings = get_settings()


def _startup() -> None:
    settings.resolved_storage_path.mkdir(parents=True, exist_ok=True)
    configure_engine(settings.database_target())
    init_database()
    build_meeting_service().recover_interrupted()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    _startup()
    yield


app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_exception_handler(AppError, app_error_handler)  # type: ignore[arg-type]
app.include_router(api_router)


def main() -> None:
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug,
    )


if __name__ == "__main__":
    main()
