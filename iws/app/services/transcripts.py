from __future__ import annotations

from pathlib import Path
from uuid import UUID

from app.config import Settings
from app.enums import TranscriptSource
from app.exceptions import BadRequestError
from app.models.transcripts import Transcript, TranscriptSegment
from app.providers.base import TranscriptionProvider
from app.repositories.meetings import RecordingRepository
from app.repositories.transcripts import TranscriptRepository, TranscriptSegmentRepository
from app.services.meetings import MeetingService
from app.utils.base import BaseUtils
from app.utils.chunking import TextUnit
from app.utils.text import TextUtils


class TranscriptService:
    def __init__(
        self,
        meetings: MeetingService,
        recordings: RecordingRepository,
        transcripts: TranscriptRepository,
        segments: TranscriptSegmentRepository,
        transcriber: TranscriptionProvider,
        settings: Settings,
    ) -> None:
        self._meetings = meetings
        self._recordings = recordings
        self._transcripts = transcripts
        self._segments = segments
        self._transcriber = transcriber
        self._settings = settings

    # -- creation -----------------------------------------------------------

    def transcribe_meeting(self, meeting_id: UUID, *, retranscribe: bool = False) -> list[Transcript]:
        """Transcribe every recording that has no transcript yet (or all, if ``retranscribe``)."""
        meeting = self._meetings.get(meeting_id)
        if retranscribe:
            self._transcripts.delete_for_meeting(meeting_id, TranscriptSource.STT)

        done = {t.recording_id for t in self._transcripts.list_for_meeting(meeting_id)}
        language = meeting.language or self._settings.stt_language or None
        created: list[Transcript] = []
        for recording in self._recordings.list_for_meeting(meeting_id):
            if recording.id in done:
                continue
            result = self._transcriber.transcribe(Path(recording.storage_path), language=language)
            created.append(
                self._store(
                    meeting_id,
                    recording_id=recording.id,
                    source=TranscriptSource.STT,
                    units=result.segments,
                    language=result.language or language,
                    duration_ms=result.duration_ms or recording.duration_ms,
                    model=self._settings.stt_model,
                )
            )
        return created

    def import_transcript(
        self,
        meeting_id: UUID,
        *,
        text: str | None = None,
        segments: list[TextUnit] | None = None,
        language: str | None = None,
    ) -> Transcript:
        """Attach a client-supplied transcript (skips speech-to-text)."""
        self._meetings.get(meeting_id)
        units = segments or TextUtils.parse_plain_transcript(text or "")
        if not units:
            raise BadRequestError("Transcript is empty")
        return self._store(
            meeting_id,
            recording_id=None,
            source=TranscriptSource.IMPORTED,
            units=units,
            language=language,
            duration_ms=None,
            model=None,
        )

    def _store(
        self,
        meeting_id: UUID,
        *,
        recording_id: UUID | None,
        source: TranscriptSource,
        units: list[TextUnit],
        language: str | None,
        duration_ms: int | None,
        model: str | None,
    ) -> Transcript:
        transcript = self._transcripts.save(
            Transcript(
                **BaseUtils.new_row(),
                meeting_id=meeting_id,
                recording_id=recording_id,
                source=source,
                language=language,
                model=model,
                duration_ms=duration_ms,
                full_text="\n".join(unit.text for unit in units),
            )
        )
        self._segments.add_all(
            TranscriptSegment(
                **BaseUtils.new_row(),
                transcript_id=transcript.id,
                seq=index,
                speaker=unit.speaker,
                start_ms=unit.start_ms,
                end_ms=unit.end_ms,
                text=unit.text,
            )
            for index, unit in enumerate(units)
        )
        return transcript

    # -- reading ------------------------------------------------------------

    def get_detail(self, meeting_id: UUID) -> list[tuple[Transcript, list[TranscriptSegment]]]:
        self._meetings.get(meeting_id)
        return [
            (transcript, self._segments.list_for_transcript(transcript.id))
            for transcript in self._transcripts.list_for_meeting(meeting_id)
        ]

    def units(self, meeting_id: UUID) -> list[TextUnit]:
        return [
            TextUnit(text=s.text, start_ms=s.start_ms, end_ms=s.end_ms, speaker=s.speaker)
            for s in self._segments.list_for_meeting(meeting_id)
        ]

    def render(self, meeting_id: UUID) -> str:
        """Whole meeting as ``[mm:ss] Speaker: text`` lines — the LLM input format."""
        lines = []
        for unit in self.units(meeting_id):
            stamp = f"[{TextUtils.format_timestamp(unit.start_ms)}] " if unit.start_ms is not None else ""
            lines.append(f"{stamp}{unit.line()}")
        return "\n".join(lines)
