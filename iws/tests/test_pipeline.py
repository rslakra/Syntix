"""End-to-end API tests with SQLite and the fake AI providers (see conftest.py)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _create_meeting(title: str = "Budget sync") -> str:
    response = client.post(
        "/meetings", json={"title": title, "participants": [{"name": "Ana"}, {"name": "Bob"}]}
    )
    assert response.status_code == 201
    assert len(response.json()["participants"]) == 2
    return response.json()["id"]


def test_import_transcript_then_process_and_ask() -> None:
    meeting_id = _create_meeting()
    imported = client.post(
        f"/meetings/{meeting_id}/transcript",
        json={
            "text": "Ana: We decided to cut the cloud budget by ten percent.\n"
            "Bob: I will send the revised budget to finance by Friday."
        },
    )
    assert imported.status_code == 201
    assert [s["speaker"] for s in imported.json()["segments"]] == ["Ana", "Bob"]

    # TestClient runs background tasks before returning, so the pipeline has finished.
    assert client.post(f"/meetings/{meeting_id}/process").status_code == 202
    meeting = client.get(f"/meetings/{meeting_id}").json()
    assert meeting["status"] == "READY", meeting["error_message"]

    summary = client.get(f"/meetings/{meeting_id}/summary").json()
    assert summary["version"] == 1 and summary["content"]

    enrichment = client.get(f"/meetings/{meeting_id}/enrichment").json()
    assert enrichment["action_items"] and enrichment["decisions"] and enrichment["topics"]

    answer = client.post(
        "/ask", json={"question": "What about the cloud budget?", "meeting_id": meeting_id}
    )
    assert answer.status_code == 200
    body = answer.json()
    assert body["answer"]
    assert body["sources"] and body["sources"][0]["meeting_id"] == meeting_id

    # Follow-up in the same thread keeps history.
    follow_up = client.post(
        "/ask",
        json={"question": "Who sends it?", "conversation_id": body["conversation_id"]},
    )
    assert follow_up.status_code == 200
    messages = client.get(f"/conversations/{body['conversation_id']}/messages").json()
    assert [m["role"] for m in messages] == ["USER", "ASSISTANT", "USER", "ASSISTANT"]

    hits = client.post("/search", json={"query": "cloud budget", "meeting_id": meeting_id}).json()
    assert hits and "budget" in hits[0]["text"].lower()


def test_recording_upload_is_transcribed() -> None:
    meeting_id = _create_meeting("Standup")
    upload = client.post(
        f"/meetings/{meeting_id}/recordings",
        files={"file": ("standup.webm", b"not-really-audio", "audio/webm")},
    )
    assert upload.status_code == 201
    assert upload.json()["size_bytes"] == len(b"not-really-audio")
    assert client.get(f"/meetings/{meeting_id}").json()["status"] == "RECORDED"

    assert client.post(f"/meetings/{meeting_id}/process").status_code == 202
    meeting = client.get(f"/meetings/{meeting_id}").json()
    assert meeting["status"] == "READY", meeting["error_message"]

    transcripts = client.get(f"/meetings/{meeting_id}/transcript").json()
    assert len(transcripts) == 1 and transcripts[0]["source"] == "STT"
    assert transcripts[0]["segments"][0]["text"].startswith("Fake transcript of")

    # Re-processing is idempotent: no duplicate transcript, new summary version.
    assert client.post(f"/meetings/{meeting_id}/process").status_code == 202
    assert len(client.get(f"/meetings/{meeting_id}/transcript").json()) == 1
    assert client.get(f"/meetings/{meeting_id}/summary").json()["version"] == 2


def test_process_without_content_is_rejected() -> None:
    meeting_id = _create_meeting("Empty")

    response = client.post(f"/meetings/{meeting_id}/process")

    assert response.status_code == 400


def test_empty_upload_is_rejected() -> None:
    meeting_id = _create_meeting("Empty upload")

    response = client.post(
        f"/meetings/{meeting_id}/recordings", files={"file": ("a.wav", b"", "audio/wav")}
    )

    assert response.status_code == 400


def test_deleted_meeting_is_hidden() -> None:
    meeting_id = _create_meeting("To delete")

    assert client.delete(f"/meetings/{meeting_id}").status_code == 204
    assert client.get(f"/meetings/{meeting_id}").status_code == 404
    assert meeting_id not in [m["id"] for m in client.get("/meetings").json()]


def test_patch_sets_start_and_end_times() -> None:
    meeting_id = _create_meeting("Live call")

    started = client.patch(f"/meetings/{meeting_id}", json={"started_at": "2025-01-01T10:00:00Z"})
    assert started.status_code == 200
    assert started.json()["started_at"].startswith("2025-01-01T10:00:00")
    assert started.json()["title"] == "Live call"  # untouched fields stay
    assert len(started.json()["participants"]) == 2

    ended = client.patch(f"/meetings/{meeting_id}", json={"ended_at": "2025-01-01T10:30:00Z"})
    assert ended.json()["started_at"].startswith("2025-01-01T10:00:00")
    assert ended.json()["ended_at"].startswith("2025-01-01T10:30:00")

    cleared = client.patch(f"/meetings/{meeting_id}", json={"description": None})
    assert cleared.status_code == 200 and cleared.json()["description"] is None


def test_patch_rejects_null_title_and_unknown_meeting() -> None:
    meeting_id = _create_meeting("Keep title")

    assert client.patch(f"/meetings/{meeting_id}", json={"title": None}).status_code == 422
    assert client.patch(f"/meetings/{meeting_id}", json={"title": ""}).status_code == 422
    missing = client.patch("/meetings/00000000-0000-0000-0000-000000000000", json={"title": "x"})
    assert missing.status_code == 404


def test_unknown_meeting_is_404() -> None:
    response = client.get("/meetings/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
