from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable
from typing import Generic, TypeVar
from uuid import UUID

from sqlalchemy import func, select

from app.db.session import session_scope

T = TypeVar("T")
K = TypeVar("K")


class BaseRepository(ABC, Generic[T, K]):
    """Persistence contract for one table or aggregate.

    Services depend on this interface so you can swap in-memory, SQLite, or
    another backend without changing route or service code.

    Type parameters:
        T: ORM model or domain row from ``app.models``.
        K: primary-key type (usually ``UUID`` / ``str``).
    """

    @abstractmethod
    def get_all(self) -> list[T]:
        """Return every row in the table (unordered)."""

    @abstractmethod
    def get(self, key: K) -> T | None:
        """Return one row by primary key, or ``None`` if missing."""

    @abstractmethod
    def save(self, entity: T) -> T:
        """Insert or replace a row; returns the stored entity."""

    @abstractmethod
    def delete(self, key: K) -> bool:
        """Remove a row by primary key. Returns ``True`` if a row was removed."""

    def count(self) -> int:
        """Row count — used by dashboard aggregates."""
        return len(self.get_all())


class InMemoryRepository(BaseRepository[T, K], Generic[T, K]):
    """Dict-backed repository used for local dev and tests.

    Rows are keyed by ``entity.id`` (``BaseModel`` PK). Pass ``key_fn`` only
    for tables that use a different primary-key column.
    """

    def __init__(self, key_fn: Callable[[T], K] | None = None) -> None:
        self._key_fn = key_fn or (lambda entity: str(entity.id))
        self._rows: dict[K, T] = {}

    def get_all(self) -> list[T]:
        return list(self._rows.values())

    @staticmethod
    def _normalize_key(key: K) -> K:
        if isinstance(key, UUID):
            return str(key)  # type: ignore[return-value]
        return key

    def get(self, key: K) -> T | None:
        normalized = self._normalize_key(key)
        row = self._rows.get(normalized)
        if row is not None:
            return row
        key_str = str(normalized)
        for stored_key, candidate in self._rows.items():
            if str(stored_key) == key_str:
                return candidate
        return None

    def save(self, entity: T) -> T:
        key = self._key_fn(entity)
        self._rows[key] = entity
        return entity

    def delete(self, key: K) -> bool:
        normalized = self._normalize_key(key)
        if normalized in self._rows:
            return self._rows.pop(normalized) is not None
        key_str = str(normalized)
        for stored_key in list(self._rows):
            if str(stored_key) == key_str:
                del self._rows[stored_key]
                return True
        return False

    def count(self) -> int:
        return len(self._rows)


class SqlAlchemyRepository(BaseRepository[T, K], Generic[T, K]):
    """SQLite-backed repository — one SQLAlchemy model per table."""

    def __init__(self, model: type[T]) -> None:
        self._model = model

    @staticmethod
    def _normalize_key(key: K) -> K:
        if isinstance(key, UUID):
            return str(key)  # type: ignore[return-value]
        return key

    @classmethod
    def _coerce_uuid(cls, key: K) -> UUID:
        normalized = cls._normalize_key(key)
        if isinstance(normalized, UUID):
            return normalized
        return UUID(str(normalized))

    def get_all(self) -> list[T]:
        with session_scope() as session:
            rows = list(session.scalars(select(self._model)).all())
            for row in rows:
                session.expunge(row)
            return rows

    def get(self, key: K) -> T | None:
        pk = self._coerce_uuid(key)
        with session_scope() as session:
            row = session.get(self._model, pk)
            if row is not None:
                session.expunge(row)
            return row

    def save(self, entity: T) -> T:
        with session_scope() as session:
            row = session.merge(entity)
            session.flush()
            session.refresh(row)
            session.expunge(row)
            return row

    def delete(self, key: K) -> bool:
        pk = self._coerce_uuid(key)
        with session_scope() as session:
            row = session.get(self._model, pk)
            if row is None:
                return False
            session.delete(row)
            return True

    def count(self) -> int:
        with session_scope() as session:
            total = session.scalar(select(func.count()).select_from(self._model))
            return int(total or 0)
