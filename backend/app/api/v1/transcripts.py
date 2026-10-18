from fastapi import APIRouter

from app.ai import retrieval
from app.ai.timefmt import format_timestamp
from app.api.deps import CurrentUser, DbSession
from app.schemas.transcript import SearchHitOut, SearchRequest, SummaryOut, TranscriptOut
from app.services import transcript_service

router = APIRouter(tags=["Transcripts & search"])


@router.get("/meetings/{code}/transcript", response_model=TranscriptOut)
async def get_transcript(code: str, user: CurrentUser, db: DbSession) -> TranscriptOut:
    """Full transcript, merged from all participants and ordered by time."""
    return await transcript_service.get_transcript(db, user.id, code)


@router.get("/meetings/{code}/summary", response_model=SummaryOut)
async def get_summary(code: str, user: CurrentUser, db: DbSession) -> SummaryOut:
    return await transcript_service.get_summary(db, user.id, code)


@router.post("/search", response_model=list[SearchHitOut])
async def semantic_search(data: SearchRequest, user: CurrentUser, db: DbSession) -> list[SearchHitOut]:
    """Semantic (meaning-based) search across all your meetings' transcripts."""
    hits = await retrieval.search_chunks(
        db, user.id, data.query, top_k=data.top_k, meeting_code=data.meeting_code
    )
    return [
        SearchHitOut(
            chunk_id=h.chunk_id,
            meeting_id=h.meeting_id,
            meeting_code=h.meeting_code,
            meeting_title=h.meeting_title,
            meeting_date=h.meeting_date,
            content=h.content,
            speaker_names=h.speaker_names,
            start_ms=h.start_ms,
            end_ms=h.end_ms,
            timestamp=format_timestamp(h.start_ms),
            score=h.score,
        )
        for h in hits
    ]
