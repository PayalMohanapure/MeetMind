import enum
import uuid
from typing import Any

from sqlalchemy import BigInteger, ForeignKey, Identity, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin, pg_enum


class MessageRole(str, enum.Enum):  # noqa: UP042
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class AgentConversation(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "agent_conversations"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)


class AgentMessage(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "agent_messages"
    __table_args__ = (
        Index("ix_agent_messages_conversation_created", "conversation_id", "created_at"),
        Index("ix_agent_messages_conversation_seq", "conversation_id", "seq"),
    )

    seq: Mapped[int] = mapped_column(BigInteger, Identity(always=True), nullable=False, unique=True)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("agent_conversations.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[MessageRole] = mapped_column(pg_enum(MessageRole, "message_role"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tool_name: Mapped[str | None] = mapped_column(String(100))
    # List of {meetingId, meetingCode, meetingTitle, chunkId, startMs}
    sources: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)
