"""Cross-cutting helpers that do not belong in domain enums or repositories."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any


class BaseUtils:
    """Static helpers reused by services when creating new store rows.

    Keeps UUID generation in one place so a future id strategy (sequential,
    ULID, etc.) can swap here without touching every service.
    """

    @staticmethod
    def generate_uuid() -> uuid.UUID:
        """Return a new random ``uuid4`` for ORM primary keys."""
        return uuid.uuid4()

    @staticmethod
    def utc_now() -> datetime:
        """Naive UTC timestamp — matches the ``DateTime`` audit columns."""
        return datetime.now(timezone.utc).replace(tzinfo=None)

    @classmethod
    def new_row(cls) -> dict[str, Any]:
        """``id`` + audit columns for a new ``BaseModel`` row: ``Model(**new_row(), ...)``."""
        now = cls.utc_now()
        return {"id": cls.generate_uuid(), "created_at": now, "updated_at": now}
