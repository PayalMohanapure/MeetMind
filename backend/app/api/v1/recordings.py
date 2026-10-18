from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, Form, UploadFile, status

from app.ai import pipeline
from app.api.deps import CurrentUser, DbSession
from app.core.exceptions import ConflictError, ForbiddenError
from app.models import ACTIVE_PROCESSING, MeetingStatus, ProcessingStatus, RecordingStatus
from app.schemas.meeting import ProcessingStatusOut, RecordingOut
from app.services import meeting_service, recording_service

router = APIRouter(prefix="/meetings", tags=["Recordings & processing"])


@router.post("/{code}/recordings", response_model=RecordingOut, status_code=status.HTTP_201_CREATED)
async def upload_recording(
    code: str,
    user: CurrentUser,
    db: DbSession,
    file: Annotated[UploadFile, File(description="Your microphone recording (e.g. audio/webm)")],
    offset_ms: Annotated[
        int, Form(alias="offsetMs", description="Recording start minus meeting start, in ms")
    ] = 0,
) -> RecordingOut:
    """Upload your own microphone recording after the call (multipart/form-data)."""
    meeting = await meeting_service.get_meeting_for_user(db, user.id, code)
    recording = await recording_service.save_recording(db, user, meeting, file, offset_ms)
    return RecordingOut.model_validate(recording)


@router.get("/{code}/processing-status", response_model=ProcessingStatusOut)
async def processing_status(code: str, user: CurrentUser, db: DbSession) -> ProcessingStatusOut:
    """Poll this to show AI progress: pending → transcribing → embedding → summarizing → done."""
    meeting = await meeting_service.get_meeting_for_user(db, user.id, code)
    counts = await recording_service.recording_counts(db, meeting.id)
    return ProcessingStatusOut(
        meeting_code=meeting.meeting_code,
        processing_status=meeting.processing_status,
        processing_error=meeting.processing_error,
        recordings_total=sum(counts.values()),
        recordings_transcribed=counts[RecordingStatus.TRANSCRIBED],
        recordings_failed=counts[RecordingStatus.FAILED],
    )


@router.post("/{code}/process", response_model=ProcessingStatusOut, status_code=status.HTTP_202_ACCEPTED)
async def reprocess_meeting(
    code: str, user: CurrentUser, db: DbSession, background_tasks: BackgroundTasks
) -> ProcessingStatusOut:
    """Host only. Run (or re-run) the AI pipeline now, e.g. after a failure."""
    meeting = await meeting_service.get_meeting_for_user(db, user.id, code)
    if meeting.host_id != user.id:
        raise ForbiddenError("Only the host can start processing")
    if meeting.status != MeetingStatus.ENDED:
        raise ConflictError("End the meeting before processing it")
    if meeting.processing_status in ACTIVE_PROCESSING:
        raise ConflictError("Processing is already running")

    meeting.processing_status = ProcessingStatus.PENDING
    meeting.processing_error = None
    await db.commit()
    background_tasks.add_task(pipeline.run_meeting_pipeline, meeting.id)

    counts = await recording_service.recording_counts(db, meeting.id)
    return ProcessingStatusOut(
        meeting_code=meeting.meeting_code,
        processing_status=meeting.processing_status,
        processing_error=None,
        recordings_total=sum(counts.values()),
        recordings_transcribed=counts[RecordingStatus.TRANSCRIBED],
        recordings_failed=counts[RecordingStatus.FAILED],
    )
