from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

from app.db.session import configure_engine, init_database

ROOT = Path(__file__).resolve().parent.parent


def _bootstrap_env() -> None:
    """Runs at import time so it precedes test-module imports (``app.main`` reads settings)."""
    env_file = ROOT / ".env"
    if not env_file.is_file():
        for candidate in (ROOT, *ROOT.parents):
            sample = candidate / ".env.sample"
            if sample.is_file():
                env_file.write_text(sample.read_text())
                break
    # Tests never touch the Docker services: SQLite + deterministic fake AI providers.
    os.environ["DEBUG"] = "false"  # an ambient DEBUG=release in the shell would break parsing
    os.environ["DB_BACKEND"] = "sqlite"
    os.environ["AI_PROVIDER"] = "fake"
    # Never write into the real DATA_DIR: everything (SQLite file, recordings) goes to a temp dir.
    os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="syntix-test-data-")
    os.environ["DB_PATH"] = ""
    os.environ["STORAGE_PATH"] = ""


_bootstrap_env()


@pytest.fixture(scope="session", autouse=True)
def _test_env() -> None:
    from app.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()
    # Fresh schema every run so model changes never meet a stale test.db.
    settings.resolved_db_path.unlink(missing_ok=True)
    configure_engine(settings.database_target())
    init_database()
    yield
    get_settings.cache_clear()
