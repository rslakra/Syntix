"""Audit timestamp columns for mutable entities."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import AbstractModel


class AuditableModel(AbstractModel):
    """Abstract parent with lifecycle timestamps."""

    __abstract__ = True

    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    delete_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
