from __future__ import annotations

import logging
import time
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import URL, Engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.db.base import AbstractModel

logger = logging.getLogger(__name__)

_engine: Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


def _configure_sqlite_connection(dbapi_connection, _connection_record) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=30000")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()


def configure_engine(target: Path | URL | str) -> None:
    """Bind the engine: a ``Path`` selects SQLite, a URL/str selects that database."""
    global _engine, _SessionLocal
    if _engine is not None:
        _engine.dispose()

    if isinstance(target, Path):
        target.parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(
            f"sqlite:///{target}",
            connect_args={"check_same_thread": False, "timeout": 30},
            poolclass=NullPool,
        )
        event.listen(engine, "connect", _configure_sqlite_connection)
    else:
        engine = create_engine(target, pool_pre_ping=True)

    _engine = engine
    _SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)


def get_session_factory() -> sessionmaker[Session]:
    if _SessionLocal is None:
        raise RuntimeError("Database engine not configured. Call configure_engine() first.")
    return _SessionLocal


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    """Yield a committed/rolled-back SQLAlchemy session."""
    factory = get_session_factory()
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _prepare_postgres(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))


def _create_vector_indexes(engine: Engine) -> None:
    """Approximate-nearest-neighbour index for cosine search (Postgres only)."""
    from app.models.indexing import IndexChunk

    table = IndexChunk.__tablename__
    with engine.begin() as connection:
        connection.execute(
            text(
                f"CREATE INDEX IF NOT EXISTS ix_{table}_embedding_hnsw "
                f"ON {table} USING hnsw (embedding vector_cosine_ops)"
            )
        )


def init_database() -> None:
    """Create all tables defined on ``app.models`` ORM classes.

    On Postgres this also enables the ``vector`` extension and creates the HNSW
    index, retrying while the database container is still starting.
    """
    if _engine is None:
        raise RuntimeError("Database engine not configured. Call configure_engine() first.")
    import app.models  # noqa: F401 — register mappers on AbstractModel.metadata

    postgres = _engine.dialect.name == "postgresql"
    attempts = 15 if postgres else 5

    for attempt in range(1, attempts + 1):
        try:
            if postgres:
                _prepare_postgres(_engine)
            AbstractModel.metadata.create_all(_engine, checkfirst=True)
            if postgres:
                _create_vector_indexes(_engine)
            return
        except OperationalError as exc:
            retryable = postgres or "locked" in str(exc).lower()
            if not retryable or attempt == attempts:
                raise
            delay = min(2.0, 0.5 * attempt) if postgres else 0.25 * attempt
            logger.warning(
                "Database not ready during schema init (attempt %s/%s); retrying in %.2fs",
                attempt,
                attempts,
                delay,
            )
            time.sleep(delay)
