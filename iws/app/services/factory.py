"""Wire services to repositories and providers.

Plain functions so they work both as FastAPI ``Depends`` callables and from
background tasks. Objects are cheap — nothing holds a connection.
"""

from __future__ import annotations

from uuid import UUID

from app.config import get_settings
from app.providers.factory import get_chat, get_embedder, get_transcriber
from app.repositories.enrichment import (
    ActionItemRepository,
    DecisionRepository,
    TopicRepository,
)
from app.repositories.indexing import IndexChunkRepository
from app.repositories.meetings import MeetingRepository, ParticipantRepository, RecordingRepository
from app.repositories.qa import ConversationMessageRepository, ConversationRepository
from app.repositories.summaries import SummaryRepository
from app.repositories.transcripts import TranscriptRepository, TranscriptSegmentRepository
from app.services.enrichment import EnrichmentService
from app.services.indexing import IndexingService
from app.services.meetings import MeetingService
from app.services.pipeline import PipelineService
from app.services.qa import QAService
from app.services.recordings import RecordingService
from app.services.summaries import SummaryService
from app.services.transcripts import TranscriptService


def build_meeting_service() -> MeetingService:
    return MeetingService(MeetingRepository(), ParticipantRepository())


def build_recording_service() -> RecordingService:
    return RecordingService(build_meeting_service(), RecordingRepository(), get_settings())


def build_transcript_service() -> TranscriptService:
    settings = get_settings()
    return TranscriptService(
        build_meeting_service(),
        RecordingRepository(),
        TranscriptRepository(),
        TranscriptSegmentRepository(),
        get_transcriber(settings),
        settings,
    )


def build_enrichment_service() -> EnrichmentService:
    settings = get_settings()
    return EnrichmentService(
        build_meeting_service(),
        build_transcript_service(),
        get_chat(settings),
        ActionItemRepository(),
        DecisionRepository(),
        TopicRepository(),
        settings,
    )


def build_summary_service() -> SummaryService:
    settings = get_settings()
    return SummaryService(
        build_meeting_service(),
        build_transcript_service(),
        get_chat(settings),
        SummaryRepository(),
        settings,
    )


def build_indexing_service() -> IndexingService:
    settings = get_settings()
    return IndexingService(
        build_meeting_service(),
        build_transcript_service(),
        SummaryRepository(),
        IndexChunkRepository(),
        get_embedder(settings),
        settings,
    )


def build_qa_service() -> QAService:
    settings = get_settings()
    return QAService(
        build_meeting_service(),
        IndexChunkRepository(),
        ConversationRepository(),
        ConversationMessageRepository(),
        get_embedder(settings),
        get_chat(settings),
        settings,
    )


def build_pipeline_service() -> PipelineService:
    return PipelineService(
        build_meeting_service(),
        RecordingRepository(),
        build_transcript_service(),
        build_enrichment_service(),
        build_summary_service(),
        build_indexing_service(),
    )


def run_pipeline_job(meeting_id: UUID, retranscribe: bool = False) -> None:
    """Background-task entry point."""
    build_pipeline_service().run(meeting_id, retranscribe=retranscribe)
