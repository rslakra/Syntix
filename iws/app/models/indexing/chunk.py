from __future__ import annotations

import uuid

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.enums import ChunkSource
from app.models.base import BaseModel
from app.models.types import embedding_type, enum_type, meeting_fk


class IndexChunk(BaseModel):
    """A retrievable piece of a transcript or summary plus its embedding vector.

    The HNSW cosine index on ``embedding`` is created in ``init_database()`` (Postgres only).
    """

    __tablename__ = "index_chunks"

    meeting_id: Mapped[uuid.UUID] = meeting_fk()
    source: Mapped[ChunkSource] = mapped_column(enum_type(ChunkSource), nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    start_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    embedding: Mapped[list[float]] = mapped_column(embedding_type(), nullable=False)
    embedding_model: Mapped[str] = mapped_column(String(128), nullable=False)
