from __future__ import annotations

from enum import auto

from app.enums.base import BaseEnum


class MessageRole(BaseEnum):
    USER = auto()
    ASSISTANT = auto()
