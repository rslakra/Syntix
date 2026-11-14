from __future__ import annotations

import hashlib
import re
from pathlib import Path
from typing import BinaryIO
from uuid import UUID

from app.config import Settings
from app.enums import MeetingStatus
from app.exceptions import BadRequestError
from app.models.meetings import Recording
from app.repositories.meetings import RecordingRepository
from app.services.meetings import MeetingService
from app.utils.base import BaseUtils

_CHUNK_BYTES = 1024 * 1024


class RecordingService:
    """Stores uploaded media under ``DATA_DIR/recordings/<meeting_id>/`` and registers it."""

    def __init__(
        self, meetings: MeetingService, recordings: RecordingRepository, settings: Settings
    ) -> None:
        self._meetings = meetings
        self._recordings = recordings
        self._settings = settings

    def save_upload(
        self, meeting_id: UUID, *, filename: str | None, content_type: str | None, stream: BinaryIO
    ) -> Recording:
        meeting = self._meetings.get(meeting_id)

        row = BaseUtils.new_row()
        original = Path(filename or "recording").name
        suffix = re.sub(r"[^a-z0-9.]", "", Path(original).suffix.lower())[:16]
        directory = self._settings.resolved_storage_path / str(meeting_id)
        directory.mkdir(parents=True, exist_ok=True)
        destination = directory / f"{row['id']}{suffix}"

        limit = self._settings.max_upload_mb * 1024 * 1024
        digest = hashlib.sha256()
        size = 0
        try:
            with destination.open("wb") as out:
                while chunk := stream.read(_CHUNK_BYTES):
                    size += len(chunk)
                    if size > limit:
                        raise BadRequestError(
                            f"Upload exceeds MAX_UPLOAD_MB={self._settings.max_upload_mb}"
                        )
                    digest.update(chunk)
                    out.write(chunk)
            if size == 0:
                raise BadRequestError("Uploaded file is empty")
        except Exception:
            destination.unlink(missing_ok=True)
            raise

        recording = self._recordings.save(
            Recording(
                **row,
                meeting_id=meeting_id,
                filename=original[:255],
                content_type=content_type,
                size_bytes=size,
                sha256=digest.hexdigest(),
                storage_path=str(destination),
            )
        )
        if meeting.status == MeetingStatus.CREATED:
            self._meetings.set_status(meeting_id, MeetingStatus.RECORDED)
        return recording

    def list(self, meeting_id: UUID) -> list[Recording]:
        self._meetings.get(meeting_id)
        return self._recordings.list_for_meeting(meeting_id)
