"""Post-meeting AI pipeline.

    recordings ─► transcribe (Whisper) ─► merge by time ─► chunk ─► embed ─► pgvector
               ─► summary + action items (LLM)

Stages update meetings.processing_status so the frontend can show progress:
pending -> transcribing -> embedding -> summarizing -> done (or failed).

The pipeline is idempotent: running it again keeps segments already
transcribed (their audio was deleted), transcribes any new uploads, and
rebuilds chunks, summary and AI action items from scratch.
"""

import asyncio
import logging
import re
import uuid
from datetime import datetime
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import providers
from app.ai.chunking import TranscriptLineIn, chunk_transcript
from app.ai.summarizer import summarize_transcript
from app.core.compat import UTC
from app.core.config import settings
from app.core.exceptions import AppError
from app.db.session import SessionLocal
from app.models import (
    ACTIVE_PROCESSING,
    ActionItem,
    ActionItemSource,
    ActionItemStatus,
    Meeting,
    MeetingParticipant,
    MeetingSummary,
    ProcessingStatus,
    Recording,
    RecordingStatus,
    TranscriptChunk,
    TranscriptSegment,
    User,
)

logger = logging.getLogger(__name__)

# Meetings currently being processed in this process (prevents double runs).
_running: set[uuid.UUID] = set()


class PipelineError(Exception):
    """Expected failure with a message that is safe to show to users."""


async def process_meeting_after_delay(meeting_id: uuid.UUID, delay_seconds: int) -> None:
    """Background task started when a meeting ends: wait for late uploads, then run."""
    if delay_seconds > 0:
        await asyncio.sleep(delay_seconds)
    await run_meeting_pipeline(meeting_id)


async def run_meeting_pipeline(meeting_id: uuid.UUID) -> None:
    if meeting_id in _running:
        logger.info("Pipeline already running for meeting %s", meeting_id)
        return
    _running.add(meeting_id)
    try:
        async with SessionLocal() as db:
            await _run(db, meeting_id)
    finally:
        _running.discard(meeting_id)


async def _run(db: AsyncSession, meeting_id: uuid.UUID) -> None:
    meeting = await db.get(Meeting, meeting_id)
    if meeting is None or meeting.processing_status in ACTIVE_PROCESSING:
        return
    logger.info("Processing meeting %s", meeting.meeting_code)
    try:
        await _set_status(db, meeting, ProcessingStatus.TRANSCRIBING)
        await _transcribe_new_recordings(db, meeting)
        meeting = await db.get(Meeting, meeting_id)  # reload (a failed file may have rolled back)

        lines = await load_transcript_lines(db, meeting.id)
        if not lines:
            raise PipelineError(
                "No speech was transcribed. Make sure recording was on and audio was uploaded."
            )

        await _set_status(db, meeting, ProcessingStatus.EMBEDDING)
        await _rebuild_chunks(db, meeting, lines)

        await _set_status(db, meeting, ProcessingStatus.SUMMARIZING)
        await _rebuild_summary(db, meeting, lines)

        meeting.processing_status = ProcessingStatus.DONE
        meeting.processing_error = None
        await db.commit()
        logger.info("Meeting %s processed successfully", meeting.meeting_code)
    except Exception as exc:  # noqa: BLE001 - every failure must be recorded on the meeting
        await db.rollback()
        if isinstance(exc, PipelineError | AppError):
            message = str(exc)
        else:
            logger.exception("Pipeline failed for meeting %s", meeting_id)
            message = f"Processing failed ({type(exc).__name__}). Please try again."
        meeting = await db.get(Meeting, meeting_id)
        if meeting is not None:
            meeting.processing_status = ProcessingStatus.FAILED
            meeting.processing_error = message[:1000]
            await db.commit()


async def _set_status(db: AsyncSession, meeting: Meeting, status: ProcessingStatus) -> None:
    meeting.processing_status = status
    meeting.processing_error = None
    await db.commit()


# --- Stage 1: transcription ---------------------------------------------------


async def _transcribe_new_recordings(db: AsyncSession, meeting: Meeting) -> None:
    meeting_id = meeting.id
    # Work with plain ids: a rollback after one failed file expires ORM objects.
    recording_ids = list(
        await db.scalars(
            select(Recording.id)
            .where(Recording.meeting_id == meeting_id, Recording.status == RecordingStatus.UPLOADED)
            .order_by(Recording.created_at)
        )
    )
    if not recording_ids:
        return

    transcriber = providers.get_transcriber()  # raises a clear error if no API key
    for recording_id in recording_ids:
        recording = await db.get(Recording, recording_id)
        path = Path(recording.file_path) if recording.file_path else None
        try:
            if path is None or not path.exists():
                raise PipelineError("Audio file is missing on the server")
            raw_segments = await transcriber.transcribe(path)
            for seg in raw_segments:
                db.add(
                    TranscriptSegment(
                        meeting_id=meeting_id,
                        recording_id=recording.id,
                        speaker_user_id=recording.user_id,
                        # Whisper times are relative to the recording; shift them
                        # to the meeting timeline so all speakers line up.
                        start_ms=recording.offset_ms + int(seg.start_s * 1000),
                        end_ms=recording.offset_ms + int(seg.end_s * 1000),
                        text=seg.text,
                    )
                )
            recording.status = RecordingStatus.TRANSCRIBED
            recording.error = None
            await db.commit()
            # Privacy + disk space: raw audio is not kept after transcription.
            path.unlink(missing_ok=True)
            recording.file_path = None
            await db.commit()
        except Exception as exc:  # noqa: BLE001 - one bad file must not stop the others
            await db.rollback()
            logger.warning("Transcription failed for recording %s: %s", recording_id, exc)
            failed = await db.get(Recording, recording_id)
            if failed is not None:
                failed.status = RecordingStatus.FAILED
                failed.error = str(exc)[:1000]
                await db.commit()


async def load_transcript_lines(db: AsyncSession, meeting_id: uuid.UUID) -> list[TranscriptLineIn]:
    rows = await db.execute(
        select(TranscriptSegment, User.full_name)
        .join(User, User.id == TranscriptSegment.speaker_user_id)
        .where(TranscriptSegment.meeting_id == meeting_id)
        .order_by(TranscriptSegment.start_ms, TranscriptSegment.end_ms)
    )
    return [TranscriptLineIn(name, seg.start_ms, seg.end_ms, seg.text) for seg, name in rows]


# --- Stage 2: chunks + embeddings ------------------------------------------------


async def _rebuild_chunks(db: AsyncSession, meeting: Meeting, lines: list[TranscriptLineIn]) -> None:
    chunks = chunk_transcript(lines, settings.chunk_size_chars, settings.chunk_overlap_chars)
    # The meeting title is added to the embedded text so questions that name the
    # meeting ("in the sprint planning call...") also match.
    texts = [f"Meeting: {meeting.title}\n{c.content}" for c in chunks]
    vectors = await providers.get_embedder().embed_documents(texts)

    await db.execute(delete(TranscriptChunk).where(TranscriptChunk.meeting_id == meeting.id))
    for index, (chunk, vector) in enumerate(zip(chunks, vectors, strict=True)):
        db.add(
            TranscriptChunk(
                meeting_id=meeting.id,
                chunk_index=index,
                content=chunk.content,
                speaker_names=chunk.speaker_names,
                start_ms=chunk.start_ms,
                end_ms=chunk.end_ms,
                embedding=vector,
            )
        )
    await db.commit()


# --- Stage 3: summary + action items -----------------------------------------------


async def _rebuild_summary(db: AsyncSession, meeting: Meeting, lines: list[TranscriptLineIn]) -> None:
    participants = list(
        await db.execute(
            select(User.id, User.full_name, User.username)
            .join(MeetingParticipant, MeetingParticipant.user_id == User.id)
            .where(MeetingParticipant.meeting_id == meeting.id)
        )
    )
    llm = providers.get_json_llm()
    transcript_text = "\n".join(line.render() for line in lines)
    meeting_date = (meeting.started_at or datetime.now(UTC)).date()
    result = await summarize_transcript(
        llm,
        transcript_text,
        [p.full_name for p in participants],
        meeting_date,
        settings.summary_max_chars_per_pass,
    )

    await db.execute(delete(MeetingSummary).where(MeetingSummary.meeting_id == meeting.id))
    keep_existing = await db.scalars(
        select(ActionItem).where(
            ActionItem.meeting_id == meeting.id,
            ActionItem.source == ActionItemSource.AI_EXTRACTED,
            (ActionItem.user_modified.is_(True)) | (ActionItem.status != ActionItemStatus.OPEN),
        )
    )
    existing_kept = {normalize_text(item.description): item for item in keep_existing}
    await db.execute(
        delete(ActionItem).where(
            ActionItem.meeting_id == meeting.id,
            ActionItem.source == ActionItemSource.AI_EXTRACTED,
            ActionItem.user_modified.is_(False),
            ActionItem.status == ActionItemStatus.OPEN,
        )
    )
    db.add(
        MeetingSummary(
            meeting_id=meeting.id,
            summary=result.summary,
            key_points=result.key_points,
            decisions=result.decisions,
            model_name=llm.model_name,
        )
    )
    for item in result.action_items:
        normalized = normalize_text(item.description)
        if normalized in existing_kept:
            continue
        db.add(
            ActionItem(
                meeting_id=meeting.id,
                created_by_user_id=meeting.host_id,
                assignee_user_id=match_participant(item.assignee_name, participants),
                assignee_name=item.assignee_name,
                description=item.description,
                due_date=item.due_date,
                status=ActionItemStatus.OPEN,
                source=ActionItemSource.AI_EXTRACTED,
                user_modified=False,
            )
        )
    await db.commit()


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def match_participant(name: str | None, participants: list) -> uuid.UUID | None:
    """Link "Rahul" to the participant whose full name or username matches."""
    if not name:
        return None
    wanted = name.strip().lower()
    for p in participants:
        if wanted in {p.full_name.lower(), p.username.lower()}:
            return p.id
    first_name_matches = [p for p in participants if re.split(r"\s+", p.full_name.lower())[0] == wanted]
    return first_name_matches[0].id if len(first_name_matches) == 1 else None
