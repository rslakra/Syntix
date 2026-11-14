"""Base string enum for domain enumerations."""

from __future__ import annotations

from enum import StrEnum


class BaseEnum(StrEnum):
    """Parent for ``StrEnum`` types — member name becomes the string value."""

    @staticmethod
    def _generate_next_value_(name: str, start: int, count: int, last_values: list) -> str:
        return name
