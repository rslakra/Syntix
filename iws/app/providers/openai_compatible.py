"""Providers for any server that speaks the OpenAI REST API.

Out of the box this covers the local Docker stack:
- Ollama (``/v1/chat/completions`` and ``/v1/embeddings``)
- a faster-whisper server (``/v1/audio/transcriptions``)
and works unchanged against hosted OpenAI-compatible services.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx2

from app.exceptions import BadGatewayError, GatewayTimeoutError, ServiceUnavailableError
from app.providers.base import (
    ChatMessage,
    ChatProvider,
    EmbeddingProvider,
    TranscriptionProvider,
    TranscriptionResult,
)
from app.utils.chunking import TextUnit


class _JsonHttpClient:
    def __init__(self, base_url: str, api_key: str, timeout: float) -> None:
        self._base_url = base_url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        self._timeout = timeout

    def post(self, path: str, **kwargs: Any) -> dict[str, Any]:
        url = f"{self._base_url}{path}"
        try:
            with httpx2.Client(timeout=self._timeout) as client:
                response = client.post(url, headers=self._headers, **kwargs)
            response.raise_for_status()
            return response.json()
        except httpx2.TimeoutException as exc:
            raise GatewayTimeoutError(f"Timed out calling {url}") from exc
        except httpx2.HTTPStatusError as exc:
            detail = exc.response.text[:300]
            raise BadGatewayError(f"{url} returned {exc.response.status_code}: {detail}") from exc
        except httpx2.HTTPError as exc:
            raise ServiceUnavailableError(f"Cannot reach {url}: {exc}") from exc
        except ValueError as exc:  # response body was not JSON
            raise BadGatewayError(f"{url} returned a non-JSON response") from exc


class OpenAICompatibleTranscriber(TranscriptionProvider):
    def __init__(self, *, base_url: str, api_key: str, model: str, timeout: float) -> None:
        self._http = _JsonHttpClient(base_url, api_key, timeout)
        self._model = model

    def transcribe(self, audio_path: Path, *, language: str | None = None) -> TranscriptionResult:
        data = {"model": self._model, "response_format": "verbose_json"}
        if language:
            data["language"] = language
        with audio_path.open("rb") as handle:
            payload = self._http.post(
                "/audio/transcriptions", data=data, files={"file": (audio_path.name, handle)}
            )

        duration = payload.get("duration")
        duration_ms = int(float(duration) * 1000) if duration is not None else None
        segments = [
            TextUnit(
                text=str(raw.get("text", "")).strip(),
                start_ms=int(float(raw["start"]) * 1000) if "start" in raw else None,
                end_ms=int(float(raw["end"]) * 1000) if "end" in raw else None,
            )
            for raw in payload.get("segments") or []
            if str(raw.get("text", "")).strip()
        ]
        if not segments and str(payload.get("text", "")).strip():
            segments = [TextUnit(text=str(payload["text"]).strip(), start_ms=0, end_ms=duration_ms)]
        return TranscriptionResult(
            segments=segments, language=payload.get("language"), duration_ms=duration_ms
        )


class OpenAICompatibleChat(ChatProvider):
    def __init__(
        self, *, base_url: str, api_key: str, model: str, temperature: float, timeout: float
    ) -> None:
        self._http = _JsonHttpClient(base_url, api_key, timeout)
        self._model = model
        self._temperature = temperature

    def chat(
        self,
        messages: list[ChatMessage],
        *,
        json_mode: bool = False,
        temperature: float | None = None,
    ) -> str:
        body: dict[str, Any] = {
            "model": self._model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": self._temperature if temperature is None else temperature,
            "stream": False,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        payload = self._http.post("/chat/completions", json=body)
        try:
            return payload["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError) as exc:
            raise BadGatewayError("Unexpected chat completion response shape") from exc


class OpenAICompatibleEmbedder(EmbeddingProvider):
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        dimensions: int,
        batch_size: int,
        timeout: float,
    ) -> None:
        self._http = _JsonHttpClient(base_url, api_key, timeout)
        self._model = model
        self._dimensions = dimensions
        self._batch_size = max(batch_size, 1)

    def embed(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for start in range(0, len(texts), self._batch_size):
            batch = texts[start : start + self._batch_size]
            payload = self._http.post("/embeddings", json={"model": self._model, "input": batch})
            try:
                items = sorted(payload["data"], key=lambda item: item.get("index", 0))
                batch_vectors = [list(map(float, item["embedding"])) for item in items]
            except (KeyError, TypeError) as exc:
                raise BadGatewayError("Unexpected embeddings response shape") from exc
            if len(batch_vectors) != len(batch):
                raise BadGatewayError("Embedding count does not match input count")
            vectors.extend(batch_vectors)

        for vector in vectors:
            if len(vector) != self._dimensions:
                raise BadGatewayError(
                    f"Model '{self._model}' returned {len(vector)} dimensions but "
                    f"EMBEDDING_DIMENSIONS={self._dimensions}. Fix the setting, then recreate "
                    "the index_chunks table and re-index."
                )
        return vectors
