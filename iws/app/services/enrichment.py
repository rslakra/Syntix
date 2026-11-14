from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date
from uuid import UUID

from app.config import Settings
from app.enums import ActionItemStatus
from app.exceptions import BadGatewayError
from app.models.enrichment import ActionItem, Decision, Topic
from app.providers.base import ChatMessage, ChatProvider
from app.repositories.enrichment import (
    ActionItemRepository,
    DecisionRepository,
    TopicRepository,
)
from app.services.meetings import MeetingService
from app.services.transcripts import TranscriptService
from app.utils.base import BaseUtils
from app.utils.text import TextUtils

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You analyse meeting transcripts. Reply with ONLY a JSON object with these keys:\n"
    '  "action_items": list of {"description": str, "owner": str or null, "due_date": "YYYY-MM-DD" or null}\n'
    '  "decisions": list of {"description": str}\n'
    '  "topics": list of short topic names (strings)\n'
    "Use only information stated in the transcript. Use empty lists when nothing applies."
)


@dataclass
class EnrichmentResult:
    action_items: list[ActionItem] = field(default_factory=list)
    decisions: list[Decision] = field(default_factory=list)
    topics: list[Topic] = field(default_factory=list)


def _parse_date(value: object) -> date | None:
    try:
        return date.fromisoformat(str(value)) if value else None
    except ValueError:
        return None


def _text(value: object) -> str:
    return str(value).strip() if value is not None else ""


class EnrichmentService:
    """Extracts action items, decisions and topics from the transcript with the LLM."""

    def __init__(
        self,
        meetings: MeetingService,
        transcripts: TranscriptService,
        chat: ChatProvider,
        action_items: ActionItemRepository,
        decisions: DecisionRepository,
        topics: TopicRepository,
        settings: Settings,
    ) -> None:
        self._meetings = meetings
        self._transcripts = transcripts
        self._chat = chat
        self._action_items = action_items
        self._decisions = decisions
        self._topics = topics
        self._settings = settings

    def enrich(self, meeting_id: UUID) -> EnrichmentResult:
        """Replace the meeting's enrichment with a fresh extraction."""
        meeting = self._meetings.get(meeting_id)
        text = self._transcripts.render(meeting_id)

        found: dict[str, dict[str, dict]] = {"action_items": {}, "decisions": {}, "topics": {}}
        for window in TextUtils.windows(text, self._settings.llm_context_chars):
            data = self._ask(f"Meeting: {meeting.title}\n\nTranscript:\n{window}")
            for item in data.get("action_items") or []:
                desc = _text(item.get("description")) if isinstance(item, dict) else _text(item)
                if desc:
                    owner = _text(item.get("owner")) if isinstance(item, dict) else ""
                    due = _parse_date(item.get("due_date")) if isinstance(item, dict) else None
                    found["action_items"].setdefault(
                        desc.lower(), {"description": desc, "owner": owner or None, "due_date": due}
                    )
            for item in data.get("decisions") or []:
                desc = _text(item.get("description")) if isinstance(item, dict) else _text(item)
                if desc:
                    found["decisions"].setdefault(desc.lower(), {"description": desc})
            for item in data.get("topics") or []:
                name = _text(item.get("name")) if isinstance(item, dict) else _text(item)
                if name:
                    found["topics"].setdefault(name.lower(), {"name": name[:255]})

        self._action_items.delete_for_meeting(meeting_id)
        self._decisions.delete_for_meeting(meeting_id)
        self._topics.delete_for_meeting(meeting_id)
        self._action_items.add_all(
            ActionItem(
                **BaseUtils.new_row(), meeting_id=meeting_id, status=ActionItemStatus.OPEN, **values
            )
            for values in found["action_items"].values()
        )
        self._decisions.add_all(
            Decision(**BaseUtils.new_row(), meeting_id=meeting_id, **values)
            for values in found["decisions"].values()
        )
        self._topics.add_all(
            Topic(**BaseUtils.new_row(), meeting_id=meeting_id, **values)
            for values in found["topics"].values()
        )
        return self.get(meeting_id)

    def get(self, meeting_id: UUID) -> EnrichmentResult:
        self._meetings.get(meeting_id)
        return EnrichmentResult(
            action_items=self._action_items.list_for_meeting(meeting_id),
            decisions=self._decisions.list_for_meeting(meeting_id),
            topics=self._topics.list_for_meeting(meeting_id),
        )

    def _ask(self, user_prompt: str) -> dict:
        """Ask for JSON; small local models sometimes wrap or break it, so retry once."""
        messages = [ChatMessage("system", SYSTEM_PROMPT), ChatMessage("user", user_prompt)]
        last_error: Exception | None = None
        for attempt in (1, 2):
            reply = self._chat.chat(messages, json_mode=True, temperature=0.0)
            try:
                return TextUtils.extract_json(reply)
            except ValueError as exc:
                last_error = exc
                logger.warning("Enrichment reply was not valid JSON (attempt %s): %s", attempt, exc)
        raise BadGatewayError("The LLM did not return valid JSON for enrichment") from last_error
