from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.enums import MeetingStatus
from app.models.base import BaseModel
from app.models.types import enum_type


class Meeting(BaseModel):
    """Aggregate root: every other table hangs off a meeting."""

    __tablename__ = "meetings"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[MeetingStatus] = mapped_column(
        enum_type(MeetingStatus), nullable=False, default=MeetingStatus.CREATED, index=True
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
