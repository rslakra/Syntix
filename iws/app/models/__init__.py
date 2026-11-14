"""SQLAlchemy ORM models, grouped by domain — one sub-package per aggregate.

Hierarchy:
- ``AbstractModel`` (``app.db.base``): declarative root
- ``AuditableModel``: ``created_at``, ``updated_at``, ``delete_at``
- ``BaseModel``: UUID ``id`` primary key

Domain groups (all tables hang off ``meetings``):
- ``meetings``    — Meeting, Participant, Recording
- ``transcripts`` — Transcript, TranscriptSegment
- ``enrichment``  — ActionItem, Decision, Topic
- ``summaries``   — Summary
- ``indexing``    — IndexChunk (text + pgvector embedding)
- ``qa``          — Conversation, ConversationMessage

Importing this package registers every table on ``AbstractModel.metadata``.
"""

from app.models.auditable import AuditableModel
from app.models.base import BaseModel
from app.models.enrichment import ActionItem, Decision, Topic
from app.models.indexing import IndexChunk
from app.models.meetings import Meeting, Participant, Recording
from app.models.qa import Conversation, ConversationMessage
from app.models.summaries import Summary
from app.models.transcripts import Transcript, TranscriptSegment

__all__ = [
    "ActionItem",
    "AuditableModel",
    "BaseModel",
    "Conversation",
    "ConversationMessage",
    "Decision",
    "IndexChunk",
    "Meeting",
    "Participant",
    "Recording",
    "Summary",
    "Topic",
    "Transcript",
    "TranscriptSegment",
]
