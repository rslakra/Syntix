"""Text helpers for transcripts and LLM output."""

from __future__ import annotations

import json
import re
from typing import Any

from app.utils.chunking import TextUnit

_SPEAKER_LINE = re.compile(r"^\s*([A-Za-z][\w .'\-]{0,58}?):\s+(\S.*)$")
_CODE_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)


class TextUtils:
    @staticmethod
    def format_timestamp(ms: int | None) -> str:
        """``83000`` → ``01:23``; hours appear only when needed."""
        if ms is None:
            return ""
        total = max(ms, 0) // 1000
        hours, rest = divmod(total, 3600)
        minutes, seconds = divmod(rest, 60)
        if hours:
            return f"{hours}:{minutes:02d}:{seconds:02d}"
        return f"{minutes:02d}:{seconds:02d}"

    @staticmethod
    def windows(text: str, max_chars: int) -> list[str]:
        """Split ``text`` on line boundaries into pieces of at most ``max_chars``."""
        max_chars = max(max_chars, 1)
        if len(text) <= max_chars:
            return [text]
        result: list[str] = []
        current: list[str] = []
        size = 0
        for line in text.splitlines():
            while len(line) > max_chars:
                if current:
                    result.append("\n".join(current))
                    current, size = [], 0
                result.append(line[:max_chars])
                line = line[max_chars:]
            if current and size + len(line) + 1 > max_chars:
                result.append("\n".join(current))
                current, size = [], 0
            current.append(line)
            size += len(line) + 1
        if current:
            result.append("\n".join(current))
        return result

    @staticmethod
    def extract_json(raw: str) -> dict[str, Any]:
        """Pull the first JSON object out of an LLM reply (tolerates code fences / prose)."""
        text = raw.strip()
        fenced = _CODE_FENCE.search(text)
        if fenced:
            text = fenced.group(1).strip()
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            raise ValueError("No JSON object found in model output")
        parsed = json.loads(text[start : end + 1])
        if not isinstance(parsed, dict):
            raise ValueError("Model output is not a JSON object")
        return parsed

    @staticmethod
    def parse_plain_transcript(text: str) -> list[TextUnit]:
        """One unit per non-empty line; ``Name: words`` lines get a speaker."""
        units: list[TextUnit] = []
        for line in text.splitlines():
            if not line.strip():
                continue
            match = _SPEAKER_LINE.match(line)
            if match:
                units.append(TextUnit(text=match.group(2).strip(), speaker=match.group(1).strip()))
            else:
                units.append(TextUnit(text=line.strip()))
        return units
