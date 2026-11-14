"""Transcript aggregate: the text of a meeting and its timed segments."""

from app.models.transcripts.segment import TranscriptSegment
from app.models.transcripts.transcript import Transcript

__all__ = ["Transcript", "TranscriptSegment"]
