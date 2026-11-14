from __future__ import annotations

from uuid import UUID

from sqlalchemy import select

from app.db.session import session_scope
from app.models.qa import Conversation, ConversationMessage
from app.repositories.scoped import BulkRepository


class ConversationRepository(BulkRepository[Conversation]):
    model_class = Conversation

    def list_recent(self, *, meeting_id: UUID | None = None, limit: int = 50) -> list[Conversation]:
        stmt = select(Conversation).order_by(Conversation.created_at.desc()).limit(limit)
        if meeting_id is not None:
            stmt = stmt.where(Conversation.meeting_id == meeting_id)
        with session_scope() as session:
            rows = list(session.scalars(stmt).all())
            for row in rows:
                session.expunge(row)
            return rows


class ConversationMessageRepository(BulkRepository[ConversationMessage]):
    model_class = ConversationMessage

    def list_for_conversation(self, conversation_id: UUID) -> list[ConversationMessage]:
        stmt = (
            select(ConversationMessage)
            .where(ConversationMessage.conversation_id == conversation_id)
            .order_by(ConversationMessage.created_at)
        )
        with session_scope() as session:
            rows = list(session.scalars(stmt).all())
            for row in rows:
                session.expunge(row)
            return rows
