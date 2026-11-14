from __future__ import annotations

import uuid

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.types import meeting_fk


class Participant(BaseModel):
    __tablename__ = "meeting_participants"

    meeting_id: Mapped[uuid.UUID] = meeting_fk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
