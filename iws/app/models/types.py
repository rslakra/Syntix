"""Shared column helpers for the domain models."""

from __future__ import annotations

import uuid
from enum import Enum as PyEnum

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, Enum, ForeignKey, Uuid
from sqlalchemy.orm import MappedColumn, mapped_column
from sqlalchemy.types import TypeEngine

from app.config import get_settings


def enum_type(enum_cls: type[PyEnum]) -> Enum:
    """Store the enum as a plain ``VARCHAR`` (no native Postgres enum type to migrate)."""
    return Enum(enum_cls, native_enum=False, length=32, validate_strings=True)


def embedding_type() -> TypeEngine:
    """``vector(EMBEDDING_DIMENSIONS)`` on Postgres, a JSON list on SQLite (tests)."""
    return Vector(get_settings().embedding_dimensions).with_variant(JSON(), "sqlite")


def meeting_fk() -> MappedColumn[uuid.UUID]:
    """Indexed, cascading foreign key to ``meetings.id``."""
    return mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
