"""External AI integrations behind small interfaces: speech-to-text, chat LLM, embeddings."""

from app.providers.base import (
    ChatMessage,
    ChatProvider,
    EmbeddingProvider,
    TranscriptionProvider,
    TranscriptionResult,
)

__all__ = [
    "ChatMessage",
    "ChatProvider",
    "EmbeddingProvider",
    "TranscriptionProvider",
    "TranscriptionResult",
]
