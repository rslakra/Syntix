from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import select

from app.db.session import session_scope
from app.enums import MeetingStatus
from app.models.meetings import Meeting, Participant, Recording
from app.repositories.scoped import BulkRepository, MeetingScopedRepository


class MeetingRepository(BulkRepository[Meeting]):
    model_class = Meeting

    def list_active(self, *, limit: int = 100, offset: int = 0) -> list[Meeting]:
        """Newest first, excluding soft-deleted meetings."""
        stmt = (
            select(Meeting)
            .where(Meeting.delete_at.is_(None))
            .order_by(Meeting.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        with session_scope() as session:
            rows = list(session.scalars(stmt).all())
            for row in rows:
                session.expunge(row)
            return rows


    def list_by_status(self, statuses: Iterable[MeetingStatus]) -> list[Meeting]:
        stmt = select(Meeting).where(Meeting.status.in_(list(statuses)), Meeting.delete_at.is_(None))
        with session_scope() as session:
            rows = list(session.scalars(stmt).all())
            for row in rows:
                session.expunge(row)
            return rows


class ParticipantRepository(MeetingScopedRepository[Participant]):
    model_class = Participant


class RecordingRepository(MeetingScopedRepository[Recording]):
    model_class = Recording
