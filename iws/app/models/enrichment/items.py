from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Date, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.enums import ActionItemStatus
from app.models.base import BaseModel
from app.models.types import enum_type, meeting_fk


class ActionItem(BaseModel):
    __tablename__ = "action_items"

    meeting_id: Mapped[uuid.UUID] = meeting_fk()
    description: Mapped[str] = mapped_column(Text, nullable=False)
    owner: Mapped[str | None] = mapped_column(String(255), nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[ActionItemStatus] = mapped_column(
        enum_type(ActionItemStatus), nullable=False, default=ActionItemStatus.OPEN
    )


class Decision(BaseModel):
    __tablename__ = "decisions"

    meeting_id: Mapped[uuid.UUID] = meeting_fk()
    description: Mapped[str] = mapped_column(Text, nullable=False)


class Topic(BaseModel):
    __tablename__ = "topics"

    meeting_id: Mapped[uuid.UUID] = meeting_fk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
