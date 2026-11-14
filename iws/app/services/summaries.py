from __future__ import annotations

from uuid import UUID

from app.config import Settings
from app.exceptions import BadRequestError, NotFoundError
from app.models.summaries import Summary
from app.providers.base import ChatMessage, ChatProvider
from app.repositories.summaries import SummaryRepository
from app.services.meetings import MeetingService
from app.services.transcripts import TranscriptService
from app.utils.base import BaseUtils
from app.utils.text import TextUtils

SUMMARY_PROMPT = (
    "You write faithful meeting summaries in Markdown with these sections: "
    "## Overview, ## Key Points, ## Decisions, ## Action Items, ## Open Questions. "
    "Use only what the transcript says; never invent details. Omit a section that has no content."
)
MERGE_PROMPT = (
    "You are given partial summaries of consecutive parts of ONE meeting. Merge them into a single "
    "summary using the same Markdown sections, removing duplicates."
)


class SummaryService:
    def __init__(
        self,
        meetings: MeetingService,
        transcripts: TranscriptService,
        chat: ChatProvider,
        summaries: SummaryRepository,
        settings: Settings,
    ) -> None:
        self._meetings = meetings
        self._transcripts = transcripts
        self._chat = chat
        self._summaries = summaries
        self._settings = settings

    def summarize(self, meeting_id: UUID) -> Summary:
        """Create the next summary version. Long transcripts are summarised window by window."""
        meeting = self._meetings.get(meeting_id)
        text = self._transcripts.render(meeting_id)
        if not text.strip():
            raise BadRequestError("Meeting has no transcript to summarise")

        partials = [
            self._chat.chat(
                [
                    ChatMessage("system", SUMMARY_PROMPT),
                    ChatMessage("user", f"Meeting: {meeting.title}\n\nTranscript:\n{window}"),
                ]
            ).strip()
            for window in TextUtils.windows(text, self._settings.llm_context_chars)
        ]
        content = partials[0]
        if len(partials) > 1:
            content = self._chat.chat(
                [
                    ChatMessage("system", MERGE_PROMPT),
                    ChatMessage("user", "\n\n---\n\n".join(partials)),
                ]
            ).strip()

        previous = self._summaries.latest(meeting_id)
        return self._summaries.save(
            Summary(
                **BaseUtils.new_row(),
                meeting_id=meeting_id,
                version=(previous.version + 1) if previous else 1,
                content=content,
                model=self._settings.llm_model,
            )
        )

    def latest(self, meeting_id: UUID) -> Summary:
        self._meetings.get(meeting_id)
        summary = self._summaries.latest(meeting_id)
        if summary is None:
            raise NotFoundError(f"Meeting {meeting_id} has no summary yet")
        return summary
