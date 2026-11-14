"""UUID ``id`` primary key plus audit columns."""

from __future__ import annotations

import uuid

from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.auditable import AuditableModel


class BaseModel(AuditableModel):
    """Abstract parent for entities with UUID primary key ``id``."""

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
