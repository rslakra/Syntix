from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class AbstractModel(DeclarativeBase):
    """SQLAlchemy declarative base — metadata for all ``app.models`` tables."""
