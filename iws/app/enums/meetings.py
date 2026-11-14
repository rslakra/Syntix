from __future__ import annotations

from enum import auto

from app.enums.base import BaseEnum


class MeetingStatus(BaseEnum):
    """Where a meeting is in the processing pipeline."""

    CREATED = auto()
    RECORDED = auto()
    QUEUED = auto()
    TRANSCRIBING = auto()
    ENRICHING = auto()
    SUMMARIZING = auto()
    INDEXING = auto()
    READY = auto()
    FAILED = auto()

    @classmethod
    def in_progress(cls) -> frozenset[MeetingStatus]:
        return frozenset({cls.QUEUED, cls.TRANSCRIBING, cls.ENRICHING, cls.SUMMARIZING, cls.INDEXING})
