import uuid
from datetime import datetime
from typing import Any

from pydantic import Field

from app.models import MessageRole
from app.schemas.common import CamelModel


class AgentChatRequest(CamelModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: uuid.UUID | None = None


class SourceOut(CamelModel):
    meeting_id: uuid.UUID
    meeting_code: str
    meeting_title: str
    chunk_id: uuid.UUID | None = None
    start_ms: int | None = None
    timestamp: str | None = None


class AgentChatResponse(CamelModel):
    conversation_id: uuid.UUID
    reply: str
    sources: list[SourceOut]
    tools_used: list[str]


class ConversationOut(CamelModel):
    id: uuid.UUID
    title: str
    created_at: datetime


class AgentMessageOut(CamelModel):
    id: uuid.UUID
    role: MessageRole
    content: str
    tool_name: str | None
    sources: list[dict[str, Any]] | None
    created_at: datetime


class ConversationDetail(ConversationOut):
    messages: list[AgentMessageOut]
