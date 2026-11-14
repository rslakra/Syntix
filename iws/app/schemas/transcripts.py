from __future__ import annotations

from datetime import datetime
from typing import Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.enums import TranscriptSource


class SegmentIn(BaseModel):
    text: str = Field(min_length=1)
    speaker: str | None = Field(default=None, max_length=255)
    start_ms: int | None = Field(default=None, ge=0)
    end_ms: int | None = Field(default=None, ge=0)


class TranscriptImport(BaseModel):
    """Either ``text`` (one utterance per line, ``Name: words`` sets the speaker) or ``segments``."""

    text: str | None = None
    segments: list[SegmentIn] | None = None
    language: str | None = Field(default=None, max_length=16)

    @model_validator(mode="after")
    def _require_content(self) -> Self:
        if not (self.text and self.text.strip()) and not self.segments:
            raise ValueError("Provide 'text' or 'segments'")
        return self


class SegmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    seq: int
    speaker: str | None
    start_ms: int | None
    end_ms: int | None
    text: str


class TranscriptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    meeting_id: UUID
    recording_id: UUID | None
    source: TranscriptSource
    language: str | None
    model: str | None
    duration_ms: int | None
    created_at: datetime | None
    segments: list[SegmentOut] = Field(default_factory=list)
