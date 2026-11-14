from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, defer

from app.db.session import session_scope
from app.models.indexing import IndexChunk
from app.models.meetings import Meeting
from app.repositories.scoped import MeetingScopedRepository


@dataclass(frozen=True)
class ChunkHit:
    chunk: IndexChunk
    meeting_title: str
    score: float  # cosine similarity, 1.0 = identical direction


def _cosine(a: Sequence[float], b: Sequence[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0


class IndexChunkRepository(MeetingScopedRepository[IndexChunk]):
    model_class = IndexChunk
    order_by = "chunk_index"

    def replace_for_meeting(self, meeting_id: UUID, chunks: list[IndexChunk]) -> int:
        """Swap a meeting's chunks atomically (re-indexing never leaves a half-empty index)."""
        count = len(chunks)
        with session_scope() as session:
            session.execute(delete(IndexChunk).where(IndexChunk.meeting_id == meeting_id))
            session.add_all(chunks)
        return count

    def search(
        self, vector: list[float], *, limit: int, meeting_id: UUID | None = None
    ) -> list[ChunkHit]:
        """Nearest chunks by cosine similarity, ignoring soft-deleted meetings.

        Postgres uses pgvector (HNSW index); SQLite (tests) scores in Python.
        """
        with session_scope() as session:
            if session.get_bind().dialect.name == "postgresql":
                return self._search_pgvector(session, vector, limit, meeting_id)
            return self._search_python(session, vector, limit, meeting_id)

    @staticmethod
    def _search_pgvector(
        session: Session, vector: list[float], limit: int, meeting_id: UUID | None
    ) -> list[ChunkHit]:
        distance = IndexChunk.embedding.cosine_distance(vector).label("distance")
        stmt = (
            select(IndexChunk, Meeting.title, distance)
            .join(Meeting, Meeting.id == IndexChunk.meeting_id)
            .where(Meeting.delete_at.is_(None))
            .options(defer(IndexChunk.embedding))
            .order_by(distance)
            .limit(limit)
        )
        if meeting_id is not None:
            stmt = stmt.where(IndexChunk.meeting_id == meeting_id)
        hits: list[ChunkHit] = []
        for chunk, title, dist in session.execute(stmt).all():
            session.expunge(chunk)
            hits.append(ChunkHit(chunk, title, 1.0 - float(dist)))
        return hits

    @staticmethod
    def _search_python(
        session: Session, vector: list[float], limit: int, meeting_id: UUID | None
    ) -> list[ChunkHit]:
        stmt = (
            select(IndexChunk, Meeting.title)
            .join(Meeting, Meeting.id == IndexChunk.meeting_id)
            .where(Meeting.delete_at.is_(None))
        )
        if meeting_id is not None:
            stmt = stmt.where(IndexChunk.meeting_id == meeting_id)
        scored = [
            (chunk, title, _cosine(vector, chunk.embedding))
            for chunk, title in session.execute(stmt).all()
        ]
        scored.sort(key=lambda item: item[2], reverse=True)
        hits: list[ChunkHit] = []
        for chunk, title, score in scored[:limit]:
            session.expunge(chunk)
            hits.append(ChunkHit(chunk, title, score))
        return hits
