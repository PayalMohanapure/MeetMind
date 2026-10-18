"""Read access to transcripts and summaries."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.timefmt import format_timestamp
from app.core.exceptions import NotFoundError
from app.models import MeetingSummary, ProcessingStatus, TranscriptSegment, User
from app.schemas.transcript import SummaryOut, TranscriptLine, TranscriptOut
from app.services.meeting_service import get_meeting_for_user


async def get_transcript(db: AsyncSession, user_id: uuid.UUID, code: str) -> TranscriptOut:
    meeting = await get_meeting_for_user(db, user_id, code)
    rows = await db.execute(
        select(TranscriptSegment, User.full_name)
        .join(User, User.id == TranscriptSegment.speaker_user_id)
        .where(TranscriptSegment.meeting_id == meeting.id)
        .order_by(TranscriptSegment.start_ms, TranscriptSegment.end_ms)
    )
    lines = [
        TranscriptLine(
            speaker_user_id=seg.speaker_user_id,
            speaker_name=name,
            start_ms=seg.start_ms,
            end_ms=seg.end_ms,
            timestamp=format_timestamp(seg.start_ms),
            text=seg.text,
        )
        for seg, name in rows
    ]
    return TranscriptOut(meeting_code=meeting.meeting_code, lines=lines)


async def get_summary(db: AsyncSession, user_id: uuid.UUID, code: str) -> SummaryOut:
    meeting = await get_meeting_for_user(db, user_id, code)
    summary = await db.get(MeetingSummary, meeting.id)
    if summary is None:
        if meeting.processing_status in (ProcessingStatus.NONE, ProcessingStatus.FAILED):
            raise NotFoundError("No summary for this meeting")
        raise NotFoundError("Summary is not ready yet")
    return SummaryOut(
        meeting_code=meeting.meeting_code,
        summary=summary.summary,
        key_points=list(summary.key_points),
        decisions=list(summary.decisions),
        model_name=summary.model_name,
        created_at=summary.created_at,
    )
