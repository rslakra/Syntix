from __future__ import annotations

from app.models.enrichment import ActionItem, Decision, Topic
from app.repositories.scoped import MeetingScopedRepository


class ActionItemRepository(MeetingScopedRepository[ActionItem]):
    model_class = ActionItem


class DecisionRepository(MeetingScopedRepository[Decision]):
    model_class = Decision


class TopicRepository(MeetingScopedRepository[Topic]):
    model_class = Topic
