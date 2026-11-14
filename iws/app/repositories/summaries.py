from __future__ import annotations

from uuid import UUID

from app.models.summaries import Summary
from app.repositories.scoped import MeetingScopedRepository


class SummaryRepository(MeetingScopedRepository[Summary]):
    model_class = Summary
    order_by = "version"

    def latest(self, meeting_id: UUID) -> Summary | None:
        rows = self.list_for_meeting(meeting_id)
        return rows[-1] if rows else None
