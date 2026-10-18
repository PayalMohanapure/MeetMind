import uuid
from datetime import datetime

from pydantic import Field

from app.schemas.common import CamelModel


class TranscriptLine(CamelModel):
    speaker_user_id: uuid.UUID
    speaker_name: str
    start_ms: int
    end_ms: int
    timestamp: str  # "MM:SS" or "H:MM:SS"
    text: str


class TranscriptOut(CamelModel):
    meeting_code: str
    lines: list[TranscriptLine]


class SummaryOut(CamelModel):
    meeting_code: str
    summary: str
    key_points: list[str]
    decisions: list[str]
    model_name: str
    created_at: datetime


class SearchRequest(CamelModel):
    query: str = Field(min_length=2, max_length=500)
    meeting_code: str | None = None
    top_k: int = Field(default=6, ge=1, le=20)


class SearchHitOut(CamelModel):
    chunk_id: uuid.UUID
    meeting_id: uuid.UUID
    meeting_code: str
    meeting_title: str
    meeting_date: datetime | None
    content: str
    speaker_names: list[str]
    start_ms: int
    end_ms: int
    timestamp: str
    score: float
