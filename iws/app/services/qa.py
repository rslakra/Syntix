from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from app.config import Settings
from app.enums import MessageRole
from app.exceptions import NotFoundError
from app.models.qa import Conversation, ConversationMessage
from app.providers.base import ChatMessage, ChatProvider, EmbeddingProvider
from app.repositories.indexing import ChunkHit, IndexChunkRepository
from app.repositories.qa import ConversationMessageRepository, ConversationRepository
from app.services.meetings import MeetingService
from app.utils.base import BaseUtils
from app.utils.text import TextUtils

SYSTEM_PROMPT = (
    "You are a meeting assistant. Answer the question using ONLY the numbered meeting excerpts "
    "provided. Cite the excerpts you rely on like [1] or [2]. If they do not contain the answer, "
    "say you could not find it in the meetings. Be concise."
)
NO_CONTEXT_ANSWER = "I couldn't find anything relevant in the indexed meetings."


@dataclass
class Answer:
    conversation_id: UUID
    message_id: UUID
    answer: str
    sources: list[dict[str, Any]]


def _source(position: int, hit: ChunkHit) -> dict[str, Any]:
    chunk = hit.chunk
    return {
        "index": position,
        "chunk_id": str(chunk.id),
        "meeting_id": str(chunk.meeting_id),
        "meeting_title": hit.meeting_title,
        "source": chunk.source.value,
        "start_ms": chunk.start_ms,
        "end_ms": chunk.end_ms,
        "score": round(hit.score, 4),
        "text": chunk.text,
    }


class QAService:
    """Retrieval-augmented question answering over the vector index."""

    def __init__(
        self,
        meetings: MeetingService,
        chunks: IndexChunkRepository,
        conversations: ConversationRepository,
        messages: ConversationMessageRepository,
        embedder: EmbeddingProvider,
        chat: ChatProvider,
        settings: Settings,
    ) -> None:
        self._meetings = meetings
        self._chunks = chunks
        self._conversations = conversations
        self._messages = messages
        self._embedder = embedder
        self._chat = chat
        self._settings = settings

    def search(
        self, query: str, *, meeting_id: UUID | None = None, top_k: int | None = None
    ) -> list[dict[str, Any]]:
        """Retrieval only: the best-matching excerpts, no LLM call."""
        if meeting_id is not None:
            self._meetings.get(meeting_id)
        hits = self._retrieve(query, meeting_id, top_k)
        return [_source(i, hit) for i, hit in enumerate(hits, start=1)]

    def ask(
        self,
        question: str,
        *,
        meeting_id: UUID | None = None,
        conversation_id: UUID | None = None,
        top_k: int | None = None,
    ) -> Answer:
        conversation = self._resolve_conversation(question, meeting_id, conversation_id)
        scope = conversation.meeting_id or meeting_id
        history = self._messages.list_for_conversation(conversation.id)
        hits = self._retrieve(question, scope, top_k)
        sources = [_source(i, hit) for i, hit in enumerate(hits, start=1)]

        if hits:
            answer = self._chat.chat(self._build_messages(question, sources, history)).strip()
        else:
            answer = NO_CONTEXT_ANSWER

        self._messages.add_all(
            [
                ConversationMessage(
                    **BaseUtils.new_row(),
                    conversation_id=conversation.id,
                    role=MessageRole.USER,
                    content=question,
                )
            ]
        )
        reply = self._messages.save(
            ConversationMessage(
                **BaseUtils.new_row(),
                conversation_id=conversation.id,
                role=MessageRole.ASSISTANT,
                content=answer,
                sources=sources,
            )
        )
        return Answer(conversation.id, reply.id, answer, sources)

    # -- conversations ------------------------------------------------------

    def list_conversations(self, *, meeting_id: UUID | None = None) -> list[Conversation]:
        return self._conversations.list_recent(meeting_id=meeting_id)

    def get_messages(self, conversation_id: UUID) -> list[ConversationMessage]:
        if self._conversations.get(conversation_id) is None:
            raise NotFoundError(f"Conversation {conversation_id} not found")
        return self._messages.list_for_conversation(conversation_id)

    # -- internals ----------------------------------------------------------

    def _resolve_conversation(
        self, question: str, meeting_id: UUID | None, conversation_id: UUID | None
    ) -> Conversation:
        if conversation_id is not None:
            conversation = self._conversations.get(conversation_id)
            if conversation is None:
                raise NotFoundError(f"Conversation {conversation_id} not found")
            return conversation
        if meeting_id is not None:
            self._meetings.get(meeting_id)
        return self._conversations.save(
            Conversation(**BaseUtils.new_row(), meeting_id=meeting_id, title=question[:80])
        )

    def _retrieve(self, query: str, meeting_id: UUID | None, top_k: int | None) -> list[ChunkHit]:
        vector = self._embedder.embed([query])[0]
        hits = self._chunks.search(
            vector, limit=top_k or self._settings.retrieval_top_k, meeting_id=meeting_id
        )
        return [hit for hit in hits if hit.score >= self._settings.retrieval_min_score]

    def _build_messages(
        self, question: str, sources: list[dict[str, Any]], history: list[ConversationMessage]
    ) -> list[ChatMessage]:
        excerpts = "\n\n".join(
            f'[{s["index"]}] Meeting "{s["meeting_title"]}"'
            + (f' at {TextUtils.format_timestamp(s["start_ms"])}' if s["start_ms"] is not None else "")
            + f' ({s["source"].lower()}):\n{s["text"]}'
            for s in sources
        )
        recent = history[-self._settings.qa_history_messages :] if self._settings.qa_history_messages else []
        return [
            ChatMessage("system", SYSTEM_PROMPT),
            *(ChatMessage(m.role.value.lower(), m.content) for m in recent),
            ChatMessage("user", f"Excerpts:\n{excerpts}\n\nQuestion: {question}"),
        ]
