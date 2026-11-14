"""Meeting aggregate: the meeting itself, who attended, and the captured media."""

from app.models.meetings.meeting import Meeting
from app.models.meetings.participant import Participant
from app.models.meetings.recording import Recording

__all__ = ["Meeting", "Participant", "Recording"]
