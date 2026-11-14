from app.enums import MeetingStatus
from app.services.factory import build_meeting_service


def test_interrupted_meetings_are_marked_failed() -> None:
    service = build_meeting_service()
    meeting = service.create(title="Interrupted")
    service.set_status(meeting.id, MeetingStatus.TRANSCRIBING)

    assert service.recover_interrupted() >= 1

    recovered = service.get(meeting.id)
    assert recovered.status == MeetingStatus.FAILED
    assert "restart" in (recovered.error_message or "")
