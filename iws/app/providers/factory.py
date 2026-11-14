"""Build providers from settings (``AI_PROVIDER`` and the ``STT_*`` / ``LLM_*`` / ``EMBEDDING_*`` keys)."""

from __future__ import annotations

from app.config import Settings, get_settings
from app.providers.base import ChatProvider, EmbeddingProvider, TranscriptionProvider
from app.providers.fake import FakeChat, FakeEmbedder, FakeTranscriber
from app.providers.openai_compatible import (
    OpenAICompatibleChat,
    OpenAICompatibleEmbedder,
    OpenAICompatibleTranscriber,
)


def get_transcriber(settings: Settings | None = None) -> TranscriptionProvider:
    s = settings or get_settings()
    if s.ai_provider == "fake":
        return FakeTranscriber()
    return OpenAICompatibleTranscriber(
        base_url=s.stt_base_url,
        api_key=s.stt_api_key,
        model=s.stt_model,
        timeout=s.stt_timeout_sec,
    )


def get_chat(settings: Settings | None = None) -> ChatProvider:
    s = settings or get_settings()
    if s.ai_provider == "fake":
        return FakeChat()
    return OpenAICompatibleChat(
        base_url=s.llm_base_url,
        api_key=s.llm_api_key,
        model=s.llm_model,
        temperature=s.llm_temperature,
        timeout=s.llm_timeout_sec,
    )


def get_embedder(settings: Settings | None = None) -> EmbeddingProvider:
    s = settings or get_settings()
    if s.ai_provider == "fake":
        return FakeEmbedder(s.embedding_dimensions)
    return OpenAICompatibleEmbedder(
        base_url=s.effective_embedding_base_url,
        api_key=s.effective_embedding_api_key,
        model=s.embedding_model,
        dimensions=s.embedding_dimensions,
        batch_size=s.embedding_batch_size,
        timeout=s.llm_timeout_sec,
    )
