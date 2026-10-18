import uuid
from datetime import datetime

from pydantic import Field, field_validator

from app.models import MeetingStatus, ParticipantRole, ProcessingStatus, RecordingStatus
from app.schemas.common import CamelModel


class MeetingCreate(CamelModel):
    title: str = Field(default="Untitled meeting", min_length=1, max_length=200)
    recording_enabled: bool = False

    @field_validator("title", mode="before")
    @classmethod
    def _strip_title(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class MeetingOut(CamelModel):
    id: uuid.UUID
    meeting_code: str
    title: str
    host_id: uuid.UUID
    status: MeetingStatus
    recording_enabled: bool
    processing_status: ProcessingStatus
    processing_error: str | None
    started_at: datetime | None
    ended_at: datetime | None
    created_at: datetime


class ParticipantOut(CamelModel):
    user_id: uuid.UUID
    full_name: str
    username: str
    role: ParticipantRole
    joined_at: datetime
    left_at: datetime | None


class MeetingDetail(MeetingOut):
    is_host: bool
    participants: list[ParticipantOut]


class ChatMessageOut(CamelModel):
    id: uuid.UUID
    user_id: uuid.UUID
    sender_name: str
    content: str
    created_at: datetime


class RecordingOut(CamelModel):
    id: uuid.UUID
    meeting_id: uuid.UUID
    user_id: uuid.UUID
    mime_type: str
    size_bytes: int
    offset_ms: int
    status: RecordingStatus
    created_at: datetime


class ProcessingStatusOut(CamelModel):
    meeting_code: str
    processing_status: ProcessingStatus
    processing_error: str | None
    recordings_total: int
    recordings_transcribed: int
    recordings_failed: int
