from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from app.enums import MeetingStatus
from app.exceptions import NotFoundError
from app.models.meetings import Meeting, Participant
from app.repositories.meetings import MeetingRepository, ParticipantRepository
from app.utils.base import BaseUtils


_UPDATABLE_FIELDS = frozenset(
    {"title", "description", "language", "scheduled_at", "started_at", "ended_at"}
)


@dataclass(frozen=True)
class ParticipantInput:
    name: str
    email: str | None = None


class MeetingService:
    def __init__(self, meetings: MeetingRepository, participants: ParticipantRepository) -> None:
        self._meetings = meetings
        self._participants = participants

    def create(
        self,
        *,
        title: str,
        description: str | None = None,
        language: str | None = None,
        scheduled_at: datetime | None = None,
        started_at: datetime | None = None,
        ended_at: datetime | None = None,
        participants: list[ParticipantInput] | None = None,
    ) -> Meeting:
        meeting = self._meetings.save(
            Meeting(
                **BaseUtils.new_row(),
                title=title,
                description=description,
                language=language,
                scheduled_at=scheduled_at,
                started_at=started_at,
                ended_at=ended_at,
                status=MeetingStatus.CREATED,
            )
        )
        if participants:
            self._participants.add_all(
                Participant(**BaseUtils.new_row(), meeting_id=meeting.id, name=p.name, email=p.email)
                for p in participants
            )
        return meeting

    def get(self, meeting_id: UUID) -> Meeting:
        """Return the meeting, or raise ``NotFoundError`` if missing or soft-deleted."""
        meeting = self._meetings.get(meeting_id)
        if meeting is None or meeting.delete_at is not None:
            raise NotFoundError(f"Meeting {meeting_id} not found")
        return meeting

    def update(self, meeting_id: UUID, changes: dict[str, Any]) -> Meeting:
        """Apply a partial update (``changes`` holds only the fields the client sent)."""
        unknown = set(changes) - _UPDATABLE_FIELDS
        if unknown:
            raise ValueError(f"Fields cannot be updated: {sorted(unknown)}")
        meeting = self.get(meeting_id)
        for name, value in changes.items():
            setattr(meeting, name, value)
        meeting.updated_at = BaseUtils.utc_now()
        return self._meetings.save(meeting)

    def list(self, *, limit: int = 100, offset: int = 0) -> list[Meeting]:
        return self._meetings.list_active(limit=limit, offset=offset)

    def participants(self, meeting_id: UUID) -> list[Participant]:
        return self._participants.list_for_meeting(meeting_id)

    def delete(self, meeting_id: UUID) -> None:
        """Soft delete: sets ``delete_at``; the meeting disappears from lists and search."""
        meeting = self.get(meeting_id)
        meeting.delete_at = meeting.updated_at = BaseUtils.utc_now()
        self._meetings.save(meeting)

    def recover_interrupted(self) -> int:
        """Mark meetings left mid-pipeline by a restart as FAILED so they can be re-processed."""
        stuck = self._meetings.list_by_status(MeetingStatus.in_progress())
        for meeting in stuck:
            meeting.status = MeetingStatus.FAILED
            meeting.error_message = "Interrupted by an API restart; run process again"
            meeting.updated_at = BaseUtils.utc_now()
            self._meetings.save(meeting)
        return len(stuck)

    def set_status(
        self, meeting_id: UUID, status: MeetingStatus, *, error: str | None = None
    ) -> Meeting:
        meeting = self.get(meeting_id)
        meeting.status = status
        meeting.error_message = error
        meeting.updated_at = BaseUtils.utc_now()
        return self._meetings.save(meeting)
