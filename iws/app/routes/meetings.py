from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, UploadFile, status

from app.schemas.meetings import (
    MeetingCreate,
    MeetingDetailOut,
    MeetingOut,
    MeetingUpdate,
    ParticipantOut,
    RecordingOut,
)
from app.services.factory import build_meeting_service, build_recording_service
from app.services.meetings import MeetingService, ParticipantInput
from app.services.recordings import RecordingService

router = APIRouter(prefix="/meetings", tags=["meetings"])


def _detail(service: MeetingService, meeting) -> MeetingDetailOut:
    detail = MeetingDetailOut.model_validate(meeting)
    detail.participants = [
        ParticipantOut.model_validate(p) for p in service.participants(meeting.id)
    ]
    return detail


@router.post("", response_model=MeetingDetailOut, status_code=status.HTTP_201_CREATED)
def create_meeting(
    body: MeetingCreate, service: MeetingService = Depends(build_meeting_service)
) -> MeetingDetailOut:
    meeting = service.create(
        title=body.title,
        description=body.description,
        language=body.language,
        scheduled_at=body.scheduled_at,
        started_at=body.started_at,
        ended_at=body.ended_at,
        participants=[ParticipantInput(p.name, p.email) for p in body.participants],
    )
    return _detail(service, meeting)


@router.get("", response_model=list[MeetingOut])
def list_meetings(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: MeetingService = Depends(build_meeting_service),
):
    return service.list(limit=limit, offset=offset)


@router.get("/{meeting_id}", response_model=MeetingDetailOut)
def get_meeting(
    meeting_id: UUID, service: MeetingService = Depends(build_meeting_service)
) -> MeetingDetailOut:
    return _detail(service, service.get(meeting_id))


@router.patch("/{meeting_id}", response_model=MeetingDetailOut)
def update_meeting(
    meeting_id: UUID,
    body: MeetingUpdate,
    service: MeetingService = Depends(build_meeting_service),
) -> MeetingDetailOut:
    """Change title, description, language or times — e.g. set ``started_at`` / ``ended_at``."""
    meeting = service.update(meeting_id, body.model_dump(exclude_unset=True))
    return _detail(service, meeting)


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(
    meeting_id: UUID, service: MeetingService = Depends(build_meeting_service)
) -> Response:
    service.delete(meeting_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{meeting_id}/recordings", response_model=RecordingOut, status_code=status.HTTP_201_CREATED
)
def upload_recording(
    meeting_id: UUID,
    file: UploadFile,
    service: RecordingService = Depends(build_recording_service),
):
    """Upload the audio/video captured by the client (multipart field ``file``)."""
    return service.save_upload(
        meeting_id, filename=file.filename, content_type=file.content_type, stream=file.file
    )


@router.get("/{meeting_id}/recordings", response_model=list[RecordingOut])
def list_recordings(
    meeting_id: UUID, service: RecordingService = Depends(build_recording_service)
):
    return service.list(meeting_id)
