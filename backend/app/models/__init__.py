"""Import every model here so Alembic and SQLAlchemy see all tables."""

from app.models.action_item import ActionItem, ActionItemSource, ActionItemStatus
from app.models.agent import AgentConversation, AgentMessage, MessageRole
from app.models.meeting import (
    ACTIVE_PROCESSING,
    ChatMessage,
    Meeting,
    MeetingParticipant,
    MeetingStatus,
    ParticipantRole,
    ProcessingStatus,
)
from app.models.recording import Recording, RecordingStatus
from app.models.transcript import EMBEDDING_DIM, MeetingSummary, TranscriptChunk, TranscriptSegment
from app.models.user import RefreshToken, User

__all__ = [
    "ACTIVE_PROCESSING",
    "EMBEDDING_DIM",
    "ActionItem",
    "ActionItemSource",
    "ActionItemStatus",
    "AgentConversation",
    "AgentMessage",
    "ChatMessage",
    "Meeting",
    "MeetingParticipant",
    "MeetingStatus",
    "MeetingSummary",
    "MessageRole",
    "ParticipantRole",
    "ProcessingStatus",
    "Recording",
    "RecordingStatus",
    "RefreshToken",
    "TranscriptChunk",
    "TranscriptSegment",
    "User",
]
