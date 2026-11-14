# Changelog

All notable changes to Syntix `iws` are recorded here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Each release groups its entries under these headings (omit the ones that don't apply):

- **Added** — new features
- **Changed** — changes to existing behaviour
- **Deprecated** — features that will be removed
- **Removed** — features that were removed
- **Fixed** — bug fixes
- **Security** — vulnerability fixes and hardening

## Table of Contents

1. [Unreleased](#unreleased)
2. [Initial release](#initial-release)

## Unreleased

### Added

- `make check-models` verifies that the chat, embedding and speech-to-text endpoints in `.env` answer and have the configured models (`LLM_MODEL`, `EMBEDDING_MODEL`, `STT_MODEL`)
- `PATCH /meetings/{id}`: partial update of title, description, language and the scheduled / started / ended times, so a client can mark a live meeting as started and ended
- `CORS_ORIGINS` allows the Expo web dev server (`http://localhost:8081`) of the React Native app in `ews`
- `CONTAINER_LLM_BASE_URL` / `CONTAINER_STT_BASE_URL` set the AI URLs used by the API container (defaults: the ZeroCloud container names)

### Changed

- The AI models now come from the shared [ZeroCloud](../../../../ZeroCloud/README.md) stack: the API container joins ZeroCloud's external `zerocloud` network, and `LLM_BASE_URL` defaults in `.env.sample` point at ZeroCloud's ports. Models are stored once, in ZeroCloud's `DATA_DIR`, instead of per project
- `make setup-infra` starts only Postgres; `make stack-up` checks that the `zerocloud` network exists before starting
- `DATA_DIR` now holds only `postgres/`, `recordings/` and `sqlite/`
- The README documents offline use: internet is only needed to download images and models; installed models are served from `DATA_DIR`
- The API container is named after `APP_NAME` (`syntix-iws` in `.env.sample`, which was `Syntix-IWS`) instead of the hardcoded `syntix-api`, and its compose service is renamed from `api` to `iws`. The other containers keep their names
- The speech-to-text compose service is renamed from `stt` to `speech2text` (matching its `syntix-speech2text` container); inside the stack the API now reaches it at `http://speech2text:8000/v1`
- `make pull-models` is renamed `make setup-models`, matching `setup-infra`; it now skips models that are already installed (`FORCE=1` pulls them again)
- `GET /` redirects to `/docs`, and `/favicon.ico` returns `204`, so opening the API in a browser no longer logs `404 Not Found`
- In `/docs` the **default** group (`/health`) is listed first, ahead of the tagged routers
- The Makefile resolves every path (`.env`, `requirements.txt`, `.venv`, `docker-compose.yml`) from the folder that contains it, so targets work from any directory (`make -C`, `make -f`)
- API startup uses a FastAPI lifespan handler instead of the deprecated `@app.on_event("startup")`
- The HTTP client is now `httpx2` (provider calls and `starlette.testclient`) instead of `httpx`, which Starlette's test client deprecates; the test suite runs clean with `-W error`

### Removed

- The `ollama` and `speech2text` compose services (containers `syntix-ollama`, `syntix-speech2text`), `make setup-models`, and the `OLLAMA_IMAGE`, `STT_IMAGE`, `OLLAMA_PORT`, `STT_PORT` settings; use ZeroCloud's `make start` / `make setup-models` instead. The README explains how to move existing models over
- The unused `WEB_HOST` / `WEB_PORT` settings (left over from the `ews` layout)

### Fixed

- `make install` / `make setup` now detect a virtualenv whose `pip` is broken (for example after the project folder was moved or renamed) and rebuild it instead of failing with `bad interpreter`

## Initial release

### Added

**Local-first stack**

- Postgres + pgvector, Ollama and faster-whisper run as Docker containers, bound to `127.0.0.1`
- All persistent data lives under one base folder, `DATA_DIR` (default `~/Downloads/Data/Syntix`)
- `make` targets to run the stack: `setup-infra`, `setup-models`, `stack-up`, `stack-down`, `check-infra-status`, `check-infra-logs`

**Full pipeline**

- Upload a recording or import a transcript, then process it: transcribe → enrich → summarise → index
- LLM enrichment extracts action items, decisions and topics
- Versioned Markdown summaries; a re-run appends `version + 1`
- Chunked and embedded vector index (pgvector, HNSW cosine)
- Cited question answering (`POST /ask`) with conversation history, plus semantic search (`POST /search`)

**Provider-agnostic AI**

- Speech-to-text, chat and embeddings each use the OpenAI REST API, so each can point at Ollama, another local server or a hosted service by changing `.env`
- `AI_PROVIDER=fake` for deterministic offline providers

**Domain-grouped models**

- One package per aggregate under `app/models/` (`meetings`, `transcripts`, `enrichment`, `summaries`, `indexing`, `qa`), all hanging off `meetings`

**Resumable and idempotent processing**

- Re-running `process` skips finished transcription, replaces enrichment and the index, and appends a new summary version
- Meetings left mid-run by an API restart are marked `FAILED` on startup and can be re-processed

**Long meetings**

- Enrichment and summaries work window by window (`LLM_CONTEXT_CHARS`) and merge the results
- Chunks overlap (`CHUNK_OVERLAP_CHARS`) so answers that straddle a boundary are found

**Testing**

- The pytest suite runs without Docker, using SQLite and deterministic fake providers

**Existing conventions kept**

- `BaseModel` / `AuditableModel`, `SqlAlchemyRepository`, the `AppError` hierarchy, `BaseEnum` and `BaseUtils`

### Fixed

- Nothing recorded yet.

### Known limitations

- **Recording happens in the client.** A container cannot reach a microphone, so a browser or desktop client captures audio and uploads it. There is no live streaming transcription.
- **No speaker diarisation.** STT segments carry timestamps but no speaker; imported transcripts can name speakers.
- **One in-process pipeline.** `process` uses FastAPI background tasks; there is no job queue or multi-worker coordination.
- **No auth and no migrations.** Tables come from `create_all`. Changing `EMBEDDING_DIMENSIONS` or the embedding model needs `index_chunks` dropped and meetings re-processed.
- Action-item `status` exists in the model but has no update endpoint yet.
- The `pgvector/pgvector` image was not started in this repo's CI.
- The pipeline needs ZeroCloud running for the AI calls (the tests do not).
