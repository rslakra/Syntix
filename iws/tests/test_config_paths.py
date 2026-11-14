from pathlib import Path

from app.config import Settings


def _settings(**overrides: str) -> Settings:
    return Settings(_env_file=None, **overrides)  # type: ignore[call-arg]


def test_data_folders_default_to_subfolders_of_data_dir(tmp_path: Path) -> None:
    settings = _settings(DATA_DIR=str(tmp_path), DB_PATH="", STORAGE_PATH="")

    assert settings.resolved_data_dir == tmp_path.resolve()
    assert settings.resolved_storage_path == tmp_path.resolve() / "recordings"
    assert settings.resolved_db_path == tmp_path.resolve() / "sqlite" / "app.db"


def test_relative_overrides_resolve_against_data_dir(tmp_path: Path) -> None:
    settings = _settings(DATA_DIR=str(tmp_path), DB_PATH="db/x.db", STORAGE_PATH="audio")

    assert settings.resolved_storage_path == tmp_path.resolve() / "audio"
    assert settings.resolved_db_path == tmp_path.resolve() / "db" / "x.db"


def test_tilde_in_data_dir_is_expanded() -> None:
    settings = _settings(DATA_DIR="~/Downloads/Data/Syntix")

    assert settings.resolved_data_dir == Path.home() / "Downloads" / "Data" / "Syntix"
    assert settings.resolved_storage_path.is_relative_to(settings.resolved_data_dir)
