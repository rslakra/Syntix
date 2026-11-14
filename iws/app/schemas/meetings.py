from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.enums import MeetingStatus


class ParticipantIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)


class ParticipantOut(ParticipantIn):
    model_config = ConfigDict(from_attributes=True)

    id: UUID


class MeetingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    language: str | None = Field(default=None, max_length=16, description="ISO code, e.g. 'en'")
    scheduled_at: datetime | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    participants: list[ParticipantIn] = Field(default_factory=list)


class MeetingUpdate(BaseModel):
    """Partial update: only the fields that are sent change; ``null`` clears an optional field."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    language: str | None = Field(default=None, max_length=16)
    scheduled_at: datetime | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None

    @field_validator("title")
    @classmethod
    def _title_not_null(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("title cannot be null")
        return value


class MeetingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None
    language: str | None
    scheduled_at: datetime | None
    started_at: datetime | None
    ended_at: datetime | None
    status: MeetingStatus
    error_message: str | None
    created_at: datetime | None
    updated_at: datetime | None


class MeetingDetailOut(MeetingOut):
    participants: list[ParticipantOut] = Field(default_factory=list)


class RecordingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    meeting_id: UUID
    filename: str
    content_type: str | None
    size_bytes: int
    sha256: str
    duration_ms: int | None
    created_at: datetime | None
