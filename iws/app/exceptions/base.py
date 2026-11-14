"""Base API error — subclasses map to HTTP status codes."""

from __future__ import annotations


class AppError(Exception):
    """Raise from services; route handlers convert to JSON responses."""

    status_code: int = 400

    def __init__(self, message: str) -> None:
        super().__init__(message)
