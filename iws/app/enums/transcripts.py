from __future__ import annotations

from enum import auto

from app.enums.base import BaseEnum


class TranscriptSource(BaseEnum):
    STT = auto()  # produced by the speech-to-text provider from a recording
    IMPORTED = auto()  # supplied by the client (pasted / exported transcript)
