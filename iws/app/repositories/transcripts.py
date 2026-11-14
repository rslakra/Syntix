from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, select

from app.db.session import session_scope
from app.enums import TranscriptSource
from app.models.transcripts import Transcript, TranscriptSegment
from app.repositories.scoped import BulkRepository, MeetingScopedRepository


class TranscriptRepository(MeetingScopedRepository[Transcript]):
    model_class = Transcript

    def delete_for_meeting(  # type: ignore[override]
        self, meeting_id: UUID, source: TranscriptSource | None = None
    ) -> int:
        """Delete transcripts (and their segments), optionally only those of one ``source``."""
        ids = select(Transcript.id).where(Transcript.meeting_id == meeting_id)
        if source is not None:
            ids = ids.where(Transcript.source == source)
        with session_scope() as session:
            session.execute(
                delete(TranscriptSegment).where(TranscriptSegment.transcript_id.in_(ids))
            )
            result = session.execute(delete(Transcript).where(Transcript.id.in_(ids)))
            return result.rowcount or 0


class TranscriptSegmentRepository(BulkRepository[TranscriptSegment]):
    model_class = TranscriptSegment

    def list_for_transcript(self, transcript_id: UUID) -> list[TranscriptSegment]:
        stmt = (
            select(TranscriptSegment)
            .where(TranscriptSegment.transcript_id == transcript_id)
            .order_by(TranscriptSegment.seq)
        )
        with session_scope() as session:
            rows = list(session.scalars(stmt).all())
            for row in rows:
                session.expunge(row)
            return rows

    def list_for_meeting(self, meeting_id: UUID) -> list[TranscriptSegment]:
        """All segments of a meeting: transcripts in creation order, then ``seq``."""
        stmt = (
            select(TranscriptSegment)
            .join(Transcript, Transcript.id == TranscriptSegment.transcript_id)
            .where(Transcript.meeting_id == meeting_id)
            .order_by(Transcript.created_at, TranscriptSegment.seq)
        )
        with session_scope() as session:
            rows = list(session.scalars(stmt).all())
            for row in rows:
                session.expunge(row)
            return rows
