from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, status

from app.schemas.enrichment import EnrichmentOut
from app.schemas.meetings import MeetingOut
from app.schemas.summaries import SummaryOut
from app.schemas.transcripts import SegmentOut, TranscriptImport, TranscriptOut
from app.services.enrichment import EnrichmentService
from app.services.factory import (
    build_enrichment_service,
    build_pipeline_service,
    build_summary_service,
    build_transcript_service,
    run_pipeline_job,
)
from app.services.pipeline import PipelineService
from app.services.summaries import SummaryService
from app.services.transcripts import TranscriptService
from app.utils.chunking import TextUnit

router = APIRouter(prefix="/meetings", tags=["processing"])


def _transcript_out(transcript, segments) -> TranscriptOut:
    out = TranscriptOut.model_validate(transcript)
    out.segments = [SegmentOut.model_validate(s) for s in segments]
    return out


@router.post("/{meeting_id}/process", response_model=MeetingOut, status_code=status.HTTP_202_ACCEPTED)
def process_meeting(
    meeting_id: UUID,
    background: BackgroundTasks,
    retranscribe: bool = False,
    pipeline: PipelineService = Depends(build_pipeline_service),
):
    """Run transcribe → enrich → summarise → index in the background; poll ``GET /meetings/{id}``."""
    meeting = pipeline.prepare(meeting_id)
    background.add_task(run_pipeline_job, meeting_id, retranscribe)
    return meeting


@router.post(
    "/{meeting_id}/transcript", response_model=TranscriptOut, status_code=status.HTTP_201_CREATED
)
def import_transcript(
    meeting_id: UUID,
    body: TranscriptImport,
    service: TranscriptService = Depends(build_transcript_service),
):
    """Attach an existing transcript instead of (or in addition to) uploading audio."""
    segments = (
        [TextUnit(s.text, s.start_ms, s.end_ms, s.speaker) for s in body.segments]
        if body.segments
        else None
    )
    transcript = service.import_transcript(
        meeting_id, text=body.text, segments=segments, language=body.language
    )
    segments_out = next(
        segs for stored, segs in service.get_detail(meeting_id) if stored.id == transcript.id
    )
    return _transcript_out(transcript, segments_out)


@router.get("/{meeting_id}/transcript", response_model=list[TranscriptOut])
def get_transcripts(
    meeting_id: UUID, service: TranscriptService = Depends(build_transcript_service)
):
    return [_transcript_out(t, segs) for t, segs in service.get_detail(meeting_id)]


@router.get("/{meeting_id}/enrichment", response_model=EnrichmentOut)
def get_enrichment(
    meeting_id: UUID, service: EnrichmentService = Depends(build_enrichment_service)
):
    return service.get(meeting_id)


@router.get("/{meeting_id}/summary", response_model=SummaryOut)
def get_summary(meeting_id: UUID, service: SummaryService = Depends(build_summary_service)):
    """Latest summary version."""
    return service.latest(meeting_id)
