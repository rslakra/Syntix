"""Deterministic offline providers (``AI_PROVIDER=fake``) for tests and demos."""

from __future__ import annotations

import hashlib
import json
import math
import re
from pathlib import Path

from app.providers.base import (
    ChatMessage,
    ChatProvider,
    EmbeddingProvider,
    TranscriptionProvider,
    TranscriptionResult,
)
from app.utils.chunking import TextUnit

_WORD = re.compile(r"[a-z0-9]+")


class FakeTranscriber(TranscriptionProvider):
    def transcribe(self, audio_path: Path, *, language: str | None = None) -> TranscriptionResult:
        segments = [
            TextUnit(text=f"Fake transcript of {audio_path.name}.", start_ms=0, end_ms=2000),
            TextUnit(text="We agreed to ship the release next week.", start_ms=2000, end_ms=5000),
        ]
        return TranscriptionResult(segments=segments, language=language or "en", duration_ms=5000)


class FakeChat(ChatProvider):
    def chat(
        self,
        messages: list[ChatMessage],
        *,
        json_mode: bool = False,
        temperature: float | None = None,
    ) -> str:
        if json_mode:
            return json.dumps(
                {
                    "action_items": [
                        {"description": "Send the follow-up notes", "owner": "Bob", "due_date": None}
                    ],
                    "decisions": [{"description": "Proceed with the plan"}],
                    "topics": ["planning"],
                }
            )
        return f"Fake reply to: {messages[-1].content[:200]}"


class FakeEmbedder(EmbeddingProvider):
    """Hashed bag-of-words vectors — texts sharing words get a high cosine score."""

    def __init__(self, dimensions: int) -> None:
        self._dimensions = dimensions

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_one(text) for text in texts]

    def _embed_one(self, text: str) -> list[float]:
        vector = [0.0] * self._dimensions
        for word in _WORD.findall(text.lower()):
            slot = int(hashlib.sha1(word.encode()).hexdigest()[:8], 16) % self._dimensions
            vector[slot] += 1.0
        norm = math.sqrt(sum(value * value for value in vector)) or 1.0
        return [value / norm for value in vector]
