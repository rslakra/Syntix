from __future__ import annotations

from enum import auto

from app.enums.base import BaseEnum


class ChunkSource(BaseEnum):
    """What an indexed chunk was cut from."""

    TRANSCRIPT = auto()
    SUMMARY = auto()
