"""User-scoped semantic search over transcript chunks (pgvector)."""

import uuid
from dataclasses import dataclass
from datetime import date, datetime, time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import providers
from app.core.compat import UTC
from app.models import Meeting, TranscriptChunk
from app.services.meeting_service import accessible_meeting_ids, normalize_code


@dataclass
class SearchHit:
    chunk_id: uuid.UUID
    meeting_id: uuid.UUID
    meeting_code: str
    meeting_title: str
    meeting_date: datetime | None
    content: str
    speaker_names: list[str]
    start_ms: int
    end_ms: int
    score: float  # cosine similarity, 1.0 = identical


async def search_chunks(
    db: AsyncSession,
    user_id: uuid.UUID,
    query: str,
    top_k: int = 6,
    meeting_code: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[SearchHit]:
    query_vector = await providers.get_embedder().embed_query(query)
    distance = TranscriptChunk.embedding.cosine_distance(query_vector).label("distance")

    stmt = (
        select(TranscriptChunk, Meeting, distance)
        .join(Meeting, Meeting.id == TranscriptChunk.meeting_id)
        # Security: only meetings this user participated in.
        .where(TranscriptChunk.meeting_id.in_(accessible_meeting_ids(user_id)))
    )
    if meeting_code:
        stmt = stmt.where(Meeting.meeting_code == normalize_code(meeting_code))
    if date_from:
        stmt = stmt.where(Meeting.started_at >= datetime.combine(date_from, time.min, tzinfo=UTC))
    if date_to:
        stmt = stmt.where(Meeting.started_at <= datetime.combine(date_to, time.max, tzinfo=UTC))

    rows = await db.execute(stmt.order_by(distance).limit(top_k))
    return [
        SearchHit(
            chunk_id=chunk.id,
            meeting_id=meeting.id,
            meeting_code=meeting.meeting_code,
            meeting_title=meeting.title,
            meeting_date=meeting.started_at,
            content=chunk.content,
            speaker_names=list(chunk.speaker_names),
            start_ms=chunk.start_ms,
            end_ms=chunk.end_ms,
            score=round(1.0 - float(dist), 4),
        )
        for chunk, meeting, dist in rows
    ]
