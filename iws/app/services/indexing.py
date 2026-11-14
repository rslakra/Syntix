from __future__ import annotations

from uuid import UUID

from app.config import Settings
from app.enums import ChunkSource
from app.models.indexing import IndexChunk
from app.providers.base import EmbeddingProvider
from app.repositories.indexing import IndexChunkRepository
from app.repositories.summaries import SummaryRepository
from app.services.meetings import MeetingService
from app.services.transcripts import TranscriptService
from app.utils.base import BaseUtils
from app.utils.chunking import Chunk, TextUnit, chunk_units


class IndexingService:
    """Chunks the transcript and latest summary, embeds them and stores the vectors."""

    def __init__(
        self,
        meetings: MeetingService,
        transcripts: TranscriptService,
        summaries: SummaryRepository,
        chunks: IndexChunkRepository,
        embedder: EmbeddingProvider,
        settings: Settings,
    ) -> None:
        self._meetings = meetings
        self._transcripts = transcripts
        self._summaries = summaries
        self._chunks = chunks
        self._embedder = embedder
        self._settings = settings

    def index_meeting(self, meeting_id: UUID) -> int:
        """Rebuild the meeting's index. Returns the number of chunks stored."""
        self._meetings.get(meeting_id)
        target = self._settings.chunk_target_chars
        overlap = self._settings.chunk_overlap_chars

        pending: list[tuple[ChunkSource, Chunk]] = [
            (ChunkSource.TRANSCRIPT, chunk)
            for chunk in chunk_units(self._transcripts.units(meeting_id), target, overlap)
        ]
        summary = self._summaries.latest(meeting_id)
        if summary is not None:
            paragraphs = [TextUnit(text=p) for p in summary.content.split("\n\n") if p.strip()]
            pending += [
                (ChunkSource.SUMMARY, chunk) for chunk in chunk_units(paragraphs, target, overlap)
            ]

        vectors = self._embedder.embed([chunk.text for _, chunk in pending]) if pending else []
        rows = [
            IndexChunk(
                **BaseUtils.new_row(),
                meeting_id=meeting_id,
                source=source,
                chunk_index=index,
                text=chunk.text,
                start_ms=chunk.start_ms,
                end_ms=chunk.end_ms,
                embedding=vector,
                embedding_model=self._settings.embedding_model,
            )
            for index, ((source, chunk), vector) in enumerate(zip(pending, vectors))
        ]
        return self._chunks.replace_for_meeting(meeting_id, rows)
