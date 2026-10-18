"""Upload of per-participant audio recordings."""

import logging
import uuid

import aiofiles
from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import BadRequestError, ConflictError, PayloadTooLargeError
from app.models import Meeting, MeetingStatus, ProcessingStatus, Recording, RecordingStatus, User

logger = logging.getLogger(__name__)

# MIME type -> file extension. Browsers' MediaRecorder usually produces audio/webm.
ALLOWED_AUDIO_TYPES = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "video/webm": "webm",  # some browsers label audio-only webm this way
}
_CHUNK_SIZE = 1024 * 1024


async def save_recording(
    db: AsyncSession, user: User, meeting: Meeting, upload: UploadFile, offset_ms: int
) -> Recording:
    if not meeting.recording_enabled:
        raise BadRequestError("Recording is not enabled for this meeting")
    if meeting.status == MeetingStatus.SCHEDULED:
        raise BadRequestError("The meeting has not started yet")
    if meeting.processing_status not in (ProcessingStatus.NONE, ProcessingStatus.PENDING):
        raise ConflictError("This meeting is already being processed; uploads are closed")
    if offset_ms < 0:
        raise BadRequestError("offsetMs cannot be negative")

    mime = (upload.content_type or "").split(";")[0].strip().lower()
    extension = ALLOWED_AUDIO_TYPES.get(mime)
    if extension is None:
        raise BadRequestError(
            f"Unsupported audio type '{mime or 'unknown'}'. Allowed: {', '.join(sorted(ALLOWED_AUDIO_TYPES))}"
        )

    settings.recordings_dir.mkdir(parents=True, exist_ok=True)
    path = settings.recordings_dir / f"{uuid.uuid4().hex}.{extension}"

    # Stream to disk in 1 MB pieces and stop as soon as the limit is passed.
    size = 0
    try:
        async with aiofiles.open(path, "wb") as out:
            while chunk := await upload.read(_CHUNK_SIZE):
                size += len(chunk)
                if size > settings.max_upload_bytes:
                    raise PayloadTooLargeError(f"Recording is larger than {settings.max_upload_mb} MB")
                await out.write(chunk)
    except Exception:
        path.unlink(missing_ok=True)
        raise

    if size == 0:
        path.unlink(missing_ok=True)
        raise BadRequestError("Uploaded file is empty")

    recording = Recording(
        meeting_id=meeting.id,
        user_id=user.id,
        file_path=str(path),
        mime_type=mime,
        size_bytes=size,
        offset_ms=offset_ms,
        status=RecordingStatus.UPLOADED,
    )
    db.add(recording)
    await db.commit()
    await db.refresh(recording)
    logger.info("Saved recording %s (%d bytes) for meeting %s", recording.id, size, meeting.id)
    return recording


async def recording_counts(db: AsyncSession, meeting_id: uuid.UUID) -> dict[RecordingStatus, int]:
    rows = await db.execute(
        select(Recording.status, func.count())
        .where(Recording.meeting_id == meeting_id)
        .group_by(Recording.status)
    )
    counts = {status: 0 for status in RecordingStatus}
    for status, count in rows:
        counts[status] = count
    return counts
