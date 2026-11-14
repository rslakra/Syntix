from __future__ import annotations

import logging
from uuid import UUID

from app.enums import MeetingStatus
from app.exceptions import BadRequestError, ConflictError
from app.models.meetings import Meeting
from app.repositories.meetings import RecordingRepository
from app.services.enrichment import EnrichmentService
from app.services.indexing import IndexingService
from app.services.meetings import MeetingService
from app.services.summaries import SummaryService
from app.services.transcripts import TranscriptService

logger = logging.getLogger(__name__)


class PipelineService:
    """transcribe → enrich → summarise → index, tracked on ``Meeting.status``.

    ``prepare`` validates and marks the meeting ``QUEUED`` (called inside the request);
    ``run`` does the slow work (called from a background task).
    """

    def __init__(
        self,
        meetings: MeetingService,
        recordings: RecordingRepository,
        transcripts: TranscriptService,
        enrichment: EnrichmentService,
        summaries: SummaryService,
        indexing: IndexingService,
    ) -> None:
        self._meetings = meetings
        self._recordings = recordings
        self._transcripts = transcripts
        self._enrichment = enrichment
        self._summaries = summaries
        self._indexing = indexing

    def prepare(self, meeting_id: UUID) -> Meeting:
        meeting = self._meetings.get(meeting_id)
        if meeting.status in MeetingStatus.in_progress():
            raise ConflictError(f"Meeting is already being processed ({meeting.status.value})")
        has_recordings = bool(self._recordings.list_for_meeting(meeting_id))
        if not has_recordings and not self._transcripts.render(meeting_id).strip():
            raise BadRequestError("Upload a recording or import a transcript before processing")
        return self._meetings.set_status(meeting_id, MeetingStatus.QUEUED)

    def run(self, meeting_id: UUID, *, retranscribe: bool = False) -> None:
        """Run every stage; any failure is recorded as ``FAILED`` with the error message."""
        try:
            self._meetings.set_status(meeting_id, MeetingStatus.TRANSCRIBING)
            self._transcripts.transcribe_meeting(meeting_id, retranscribe=retranscribe)
            if not self._transcripts.render(meeting_id).strip():
                raise BadRequestError("No speech was found in the recordings")

            self._meetings.set_status(meeting_id, MeetingStatus.ENRICHING)
            self._enrichment.enrich(meeting_id)

            self._meetings.set_status(meeting_id, MeetingStatus.SUMMARIZING)
            self._summaries.summarize(meeting_id)

            self._meetings.set_status(meeting_id, MeetingStatus.INDEXING)
            self._indexing.index_meeting(meeting_id)

            self._meetings.set_status(meeting_id, MeetingStatus.READY)
        except Exception as exc:  # noqa: BLE001 — surface any stage failure on the meeting
            logger.exception("Pipeline failed for meeting %s", meeting_id)
            self._meetings.set_status(meeting_id, MeetingStatus.FAILED, error=str(exc)[:2000])
