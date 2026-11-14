"""Repository bases shared by the domain repositories."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Generic, TypeVar
from uuid import UUID

from sqlalchemy import delete, select

from app.db.session import session_scope
from app.repositories.base import SqlAlchemyRepository

T = TypeVar("T")


class BulkRepository(SqlAlchemyRepository[T, UUID], Generic[T]):
    """``SqlAlchemyRepository`` bound to ``model_class`` with a fast bulk insert."""

    model_class: type[T]

    def __init__(self) -> None:
        super().__init__(self.model_class)

    def add_all(self, entities: Iterable[T]) -> int:
        """Insert new rows in one transaction. The passed objects must not be reused afterwards."""
        rows = list(entities)
        with session_scope() as session:
            session.add_all(rows)
        return len(rows)


class MeetingScopedRepository(BulkRepository[T], Generic[T]):
    """For tables with a ``meeting_id`` column."""

    order_by: str = "created_at"

    def list_for_meeting(self, meeting_id: UUID) -> list[T]:
        model = self._model
        stmt = (
            select(model)
            .where(getattr(model, "meeting_id") == meeting_id)
            .order_by(getattr(model, self.order_by))
        )
        with session_scope() as session:
            rows = list(session.scalars(stmt).all())
            for row in rows:
                session.expunge(row)
            return rows

    def delete_for_meeting(self, meeting_id: UUID) -> int:
        with session_scope() as session:
            result = session.execute(
                delete(self._model).where(getattr(self._model, "meeting_id") == meeting_id)
            )
            return result.rowcount or 0
