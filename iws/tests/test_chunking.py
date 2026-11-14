from app.utils.chunking import TextUnit, chunk_units
from app.utils.text import TextUtils


def test_chunks_respect_target_and_keep_timing() -> None:
    units = [
        TextUnit(text=f"sentence number {i} " * 3, start_ms=i * 1000, end_ms=i * 1000 + 900)
        for i in range(30)
    ]
    chunks = chunk_units(units, target_chars=300, overlap_chars=60)

    assert len(chunks) > 1
    assert all(len(chunk.text) <= 300 + 60 for chunk in chunks)
    assert chunks[0].start_ms == 0
    assert chunks[-1].end_ms == 29 * 1000 + 900


def test_chunks_overlap_between_neighbours() -> None:
    units = [TextUnit(text=f"line-{i:02d} " + "x" * 40) for i in range(20)]
    chunks = chunk_units(units, target_chars=250, overlap_chars=120)

    first_lines = chunks[0].text.splitlines()
    second_lines = chunks[1].text.splitlines()
    assert first_lines[-1] in second_lines


def test_oversized_unit_is_split() -> None:
    chunks = chunk_units([TextUnit(text="a" * 1000, start_ms=5, end_ms=9)], 200, 0)

    assert len(chunks) == 5
    assert all(chunk.start_ms == 5 and chunk.end_ms == 9 for chunk in chunks)


def test_parse_plain_transcript_detects_speakers() -> None:
    units = TextUtils.parse_plain_transcript("Ana: Hello team\n\nno speaker here\nBob Smith: Hi")

    assert [(u.speaker, u.text) for u in units] == [
        ("Ana", "Hello team"),
        (None, "no speaker here"),
        ("Bob Smith", "Hi"),
    ]


def test_extract_json_handles_fences_and_prose() -> None:
    raw = 'Sure! ```json\n{"topics": ["a"]}\n``` hope that helps'

    assert TextUtils.extract_json(raw) == {"topics": ["a"]}


def test_windows_never_exceed_limit() -> None:
    text = "\n".join("word " * 10 for _ in range(50))

    pieces = TextUtils.windows(text, 120)

    assert len(pieces) > 1
    assert all(len(piece) <= 120 for piece in pieces)
