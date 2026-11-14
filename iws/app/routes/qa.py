from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.schemas.qa import (
    AnswerOut,
    AskRequest,
    ConversationOut,
    MessageOut,
    SearchRequest,
    SourceOut,
)
from app.services.factory import build_qa_service
from app.services.qa import QAService

router = APIRouter(tags=["questions"])


@router.post("/ask", response_model=AnswerOut)
def ask(body: AskRequest, service: QAService = Depends(build_qa_service)):
    """Answer a question from the indexed meetings (all of them, or one via ``meeting_id``)."""
    return service.ask(
        body.question,
        meeting_id=body.meeting_id,
        conversation_id=body.conversation_id,
        top_k=body.top_k,
    )


@router.post("/search", response_model=list[SourceOut])
def search(body: SearchRequest, service: QAService = Depends(build_qa_service)):
    """Semantic search only — returns the matching excerpts without calling the LLM."""
    return service.search(body.query, meeting_id=body.meeting_id, top_k=body.top_k)


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(
    meeting_id: UUID | None = None, service: QAService = Depends(build_qa_service)
):
    return service.list_conversations(meeting_id=meeting_id)


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
def get_messages(conversation_id: UUID, service: QAService = Depends(build_qa_service)):
    return service.get_messages(conversation_id)
