"""Split transcript segments (or any text) into overlapping chunks for embedding."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass


@dataclass(frozen=True)
class TextUnit:
    """One utterance / paragraph, optionally timed (milliseconds) and attributed."""

    text: str
    start_ms: int | None = None
    end_ms: int | None = None
    speaker: str | None = None

    def line(self) -> str:
        return f"{self.speaker}: {self.text}" if self.speaker else self.text


@dataclass(frozen=True)
class Chunk:
    text: str
    start_ms: int | None
    end_ms: int | None


_Piece = tuple[str, TextUnit]


def _split_long(line: str, limit: int) -> list[str]:
    return [line[i : i + limit] for i in range(0, len(line), limit)]


def _tail(pieces: list[_Piece], overlap: int) -> list[_Piece]:
    """Trailing pieces whose total size fits in ``overlap`` — carried into the next chunk."""
    tail: list[_Piece] = []
    total = 0
    for piece in reversed(pieces):
        total += len(piece[0]) + 1
        if total > overlap:
            break
        tail.append(piece)
    tail.reverse()
    return tail


def _make_chunk(pieces: list[_Piece]) -> Chunk:
    starts = [unit.start_ms for _, unit in pieces if unit.start_ms is not None]
    ends = [unit.end_ms for _, unit in pieces if unit.end_ms is not None]
    return Chunk(
        text="\n".join(line for line, _ in pieces),
        start_ms=min(starts) if starts else None,
        end_ms=max(ends) if ends else None,
    )


def chunk_units(units: Iterable[TextUnit], target_chars: int, overlap_chars: int) -> list[Chunk]:
    """Greedily pack units into chunks of about ``target_chars``.

    Each chunk repeats up to ``overlap_chars`` of the previous chunk's tail so an
    answer that straddles a boundary is still retrievable. Units longer than the
    target are split by characters and keep their timing.
    """
    target = max(target_chars, 1)
    overlap = max(0, min(overlap_chars, target // 2))

    pieces: list[_Piece] = []
    for unit in units:
        line = unit.line().strip()
        if not line:
            continue
        for part in _split_long(line, target) if len(line) > target else [line]:
            pieces.append((part, unit))

    chunks: list[Chunk] = []
    current: list[_Piece] = []
    size = 0
    for piece in pieces:
        added = len(piece[0]) + 1
        if current and size + added > target:
            chunks.append(_make_chunk(current))
            current = _tail(current, overlap)
            size = sum(len(line) + 1 for line, _ in current)
        current.append(piece)
        size += added
    if current:
        chunks.append(_make_chunk(current))
    return chunks
