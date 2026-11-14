"""Contracts for the three AI capabilities the pipeline needs.

Services depend on these interfaces only, so the speech-to-text engine, the LLM
and the embedding model can each be swapped through configuration.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path

from app.utils.chunking import TextUnit


@dataclass(frozen=True)
class ChatMessage:
    role: str  # "system" | "user" | "assistant"
    content: str


@dataclass
class TranscriptionResult:
    segments: list[TextUnit] = field(default_factory=list)
    language: str | None = None
    duration_ms: int | None = None


class TranscriptionProvider(ABC):
    @abstractmethod
    def transcribe(self, audio_path: Path, *, language: str | None = None) -> TranscriptionResult:
        """Turn an audio/video file into timed segments."""


class ChatProvider(ABC):
    @abstractmethod
    def chat(
        self,
        messages: list[ChatMessage],
        *,
        json_mode: bool = False,
        temperature: float | None = None,
    ) -> str:
        """Return the assistant reply. ``json_mode`` asks for a single JSON object."""


class EmbeddingProvider(ABC):
    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        """Return one vector per input text, in order."""
