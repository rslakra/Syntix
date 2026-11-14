from __future__ import annotations

import uuid

from sqlalchemy import BigInteger, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.types import meeting_fk


class Recording(BaseModel):
    """An uploaded audio/video file. The bytes live on disk under ``DATA_DIR/recordings``."""

    __tablename__ = "recordings"

    meeting_id: Mapped[uuid.UUID] = meeting_fk()
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
