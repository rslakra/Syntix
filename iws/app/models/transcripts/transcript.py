from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.enums import TranscriptSource
from app.models.base import BaseModel
from app.models.types import enum_type, meeting_fk


class Transcript(BaseModel):
    """One transcript per recording (STT) or per import. ``full_text`` is plain text."""

    __tablename__ = "transcripts"

    meeting_id: Mapped[uuid.UUID] = meeting_fk()
    recording_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("recordings.id", ondelete="SET NULL"), nullable=True
    )
    source: Mapped[TranscriptSource] = mapped_column(enum_type(TranscriptSource), nullable=False)
    language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    full_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
