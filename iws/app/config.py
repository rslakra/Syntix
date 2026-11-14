from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL

APP_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = APP_ROOT / ".env"


class Settings(BaseSettings):
    """Loaded from ``.env`` in the project root (see ``.env.sample``).

    Real environment variables win over ``.env`` — docker-compose relies on that
    to point the containerised API at ``postgres`` and at the shared ZeroCloud
    containers (``zerocloud-ollama`` / ``zerocloud-speech2text``).
    """

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        populate_by_name=True,
        extra="ignore",
    )

    # --- Application -------------------------------------------------------
    app_name: str = Field(default="syntix-iws", alias="APP_NAME")
    app_env: str = Field(default="local", alias="APP_ENV")

    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8080, alias="API_PORT")
    debug: bool = Field(default=True, alias="DEBUG")
    cors_origins: str = Field(
        # 3000 = the ews web app, 8081 = the Expo web dev server of the ews React Native app.
        default=(
            "http://127.0.0.1:3000,http://localhost:3000,"
            "http://127.0.0.1:8081,http://localhost:8081"
        ),
        alias="CORS_ORIGINS",
    )

    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    log_file: str = Field(default="app.log", alias="LOG_FILE")
    log_max_bytes: int = Field(default=10485760, alias="LOG_MAX_BYTES")
    log_backup_count: int = Field(default=5, alias="LOG_BACKUP_COUNT")

    # --- Database ----------------------------------------------------------
    # ``postgres`` (Docker, pgvector) is the real backend; ``sqlite`` exists so
    # the test-suite runs without containers (vectors are searched in Python).
    db_backend: Literal["postgres", "sqlite"] = Field(default="postgres", alias="DB_BACKEND")
    db_host: str = Field(default="localhost", alias="DB_HOST")
    db_port: int = Field(default=5432, alias="DB_PORT")
    db_name: str = Field(default="syntix", alias="DB_NAME")
    db_user: str = Field(default="syntix", alias="DB_USER")
    db_password: str = Field(default="change-me", alias="DB_PASSWORD")
    # Empty = ``<DATA_DIR>/sqlite/app.db``.
    db_path: str = Field(default="", alias="DB_PATH")

    # --- Data folders --------------------------------------------------------
    # Base folder for this project's persistent data (docker-compose mounts its subfolders:
    # postgres/, recordings/; SQLite uses sqlite/). AI models are not stored here: the
    # shared ZeroCloud stack keeps them in its own DATA_DIR.
    data_dir: str = Field(default="~/Downloads/Data/Syntix", alias="DATA_DIR")
    # Empty = ``<DATA_DIR>/recordings``. A relative value is resolved against DATA_DIR.
    storage_path: str = Field(default="", alias="STORAGE_PATH")
    max_upload_mb: int = Field(default=1024, alias="MAX_UPLOAD_MB")

    # --- AI providers (all OpenAI-compatible HTTP endpoints, served by ZeroCloud) ---
    # ``fake`` is a deterministic offline provider used by the tests.
    ai_provider: Literal["openai_compatible", "fake"] = Field(
        default="openai_compatible", alias="AI_PROVIDER"
    )

    stt_base_url: str = Field(default="http://localhost:8000/v1", alias="STT_BASE_URL")
    stt_model: str = Field(default="Systran/faster-whisper-small", alias="STT_MODEL")
    stt_api_key: str = Field(default="not-needed", alias="STT_API_KEY")
    stt_language: str = Field(default="", alias="STT_LANGUAGE")
    stt_timeout_sec: int = Field(default=1800, alias="STT_TIMEOUT_SEC")

    llm_base_url: str = Field(default="http://localhost:11434/v1", alias="LLM_BASE_URL")
    llm_model: str = Field(default="llama3.1:8b", alias="LLM_MODEL")
    llm_api_key: str = Field(default="ollama", alias="LLM_API_KEY")
    llm_temperature: float = Field(default=0.2, alias="LLM_TEMPERATURE")
    llm_timeout_sec: int = Field(default=300, alias="LLM_TIMEOUT_SEC")
    llm_context_chars: int = Field(default=24000, alias="LLM_CONTEXT_CHARS")

    # Empty base URL / key fall back to the LLM values (Ollama serves both).
    embedding_base_url: str = Field(default="", alias="EMBEDDING_BASE_URL")
    embedding_api_key: str = Field(default="", alias="EMBEDDING_API_KEY")
    embedding_model: str = Field(default="nomic-embed-text", alias="EMBEDDING_MODEL")
    # Fixed when the ``index_chunks`` table is created — changing it later
    # requires dropping that table and re-indexing.
    embedding_dimensions: int = Field(default=768, alias="EMBEDDING_DIMENSIONS")
    embedding_batch_size: int = Field(default=32, alias="EMBEDDING_BATCH_SIZE")

    # --- Indexing and question answering -----------------------------------
    chunk_target_chars: int = Field(default=1200, alias="CHUNK_TARGET_CHARS")
    chunk_overlap_chars: int = Field(default=200, alias="CHUNK_OVERLAP_CHARS")
    retrieval_top_k: int = Field(default=6, alias="RETRIEVAL_TOP_K")
    retrieval_min_score: float = Field(default=0.0, alias="RETRIEVAL_MIN_SCORE")
    qa_history_messages: int = Field(default=6, alias="QA_HISTORY_MESSAGES")

    @property
    def resolved_data_dir(self) -> Path:
        return Path(self.data_dir).expanduser().resolve()

    @computed_field  # type: ignore[prop-decorator]
    @property
    def resolved_db_path(self) -> Path:
        if not self.db_path:
            return self.resolved_data_dir / "sqlite" / "app.db"
        path = Path(self.db_path).expanduser()
        return path if path.is_absolute() else (self.resolved_data_dir / path).resolve()

    @computed_field  # type: ignore[prop-decorator]
    @property
    def postgres_dsn(self) -> str:
        return (
            f"postgresql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def resolved_storage_path(self) -> Path:
        if not self.storage_path:
            return self.resolved_data_dir / "recordings"
        path = Path(self.storage_path).expanduser()
        return path if path.is_absolute() else (self.resolved_data_dir / path).resolve()

    @property
    def effective_embedding_base_url(self) -> str:
        return self.embedding_base_url or self.llm_base_url

    @property
    def effective_embedding_api_key(self) -> str:
        return self.embedding_api_key or self.llm_api_key

    def database_target(self) -> Path | URL:
        """What ``configure_engine`` binds to: a SQLite path or a Postgres URL."""
        if self.db_backend == "sqlite":
            return self.resolved_db_path
        return URL.create(
            "postgresql+psycopg",
            username=self.db_user,
            password=self.db_password,
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


def _require_env_file() -> None:
    if not ENV_FILE.is_file():
        raise FileNotFoundError(
            f"Missing {ENV_FILE.name}. Run: make init-env  (copies .env.sample)"
        )


@lru_cache
def get_settings() -> Settings:
    _require_env_file()
    return Settings()
