from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.enums import MessageRole


class SourceOut(BaseModel):
    index: int
    chunk_id: UUID
    meeting_id: UUID
    meeting_title: str
    source: str
    start_ms: int | None
    end_ms: int | None
    score: float
    text: str


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    meeting_id: UUID | None = Field(default=None, description="Limit retrieval to one meeting")
    conversation_id: UUID | None = Field(default=None, description="Continue an earlier thread")
    top_k: int | None = Field(default=None, ge=1, le=50)


class AnswerOut(BaseModel):
    conversation_id: UUID
    message_id: UUID
    answer: str
    sources: list[SourceOut]


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    meeting_id: UUID | None = None
    top_k: int | None = Field(default=None, ge=1, le=50)


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    meeting_id: UUID | None
    title: str | None
    created_at: datetime | None


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: MessageRole
    content: str
    sources: list[SourceOut] | None
    created_at: datetime | None
