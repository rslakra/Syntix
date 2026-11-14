from __future__ import annotations

import uuid

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.types import meeting_fk


class Summary(BaseModel):
    """Markdown summary. Re-running the pipeline appends a new ``version``."""

    __tablename__ = "summaries"

    meeting_id: Mapped[uuid.UUID] = meeting_fk()
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
