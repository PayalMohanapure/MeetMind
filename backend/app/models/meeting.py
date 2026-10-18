import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin, pg_enum
from app.models.user import User


class MeetingStatus(str, enum.Enum):  # noqa: UP042
    SCHEDULED = "scheduled"
    LIVE = "live"
    ENDED = "ended"


class ProcessingStatus(str, enum.Enum):  # noqa: UP042
    NONE = "none"
    PENDING = "pending"
    TRANSCRIBING = "transcribing"
    EMBEDDING = "embedding"
    SUMMARIZING = "summarizing"
    DONE = "done"
    FAILED = "failed"


# Statuses where the AI pipeline is currently running.
ACTIVE_PROCESSING = {
    ProcessingStatus.TRANSCRIBING,
    ProcessingStatus.EMBEDDING,
    ProcessingStatus.SUMMARIZING,
}


class ParticipantRole(str, enum.Enum):  # noqa: UP042
    HOST = "host"
    PARTICIPANT = "participant"


class Meeting(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "meetings"

    meeting_code: Mapped[str] = mapped_column(String(12), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="Untitled meeting")
    host_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    status: Mapped[MeetingStatus] = mapped_column(
        pg_enum(MeetingStatus, "meeting_status"), nullable=False, default=MeetingStatus.SCHEDULED
    )
    recording_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    processing_status: Mapped[ProcessingStatus] = mapped_column(
        pg_enum(ProcessingStatus, "processing_status"),
        nullable=False,
        default=ProcessingStatus.NONE,
    )
    processing_error: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    host: Mapped[User] = relationship(lazy="raise")


class MeetingParticipant(UUIDPrimaryKeyMixin, Base):
    """Who joined which meeting. This table drives access control."""

    __tablename__ = "meeting_participants"
    __table_args__ = (UniqueConstraint("meeting_id", "user_id", name="uq_meeting_participants_meeting_user"),)

    meeting_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    role: Mapped[ParticipantRole] = mapped_column(
        pg_enum(ParticipantRole, "participant_role"),
        nullable=False,
        default=ParticipantRole.PARTICIPANT,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(lazy="raise")


class ChatMessage(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        Index("ix_chat_messages_meeting_created", "meeting_id", "created_at"),
        Index("ix_chat_messages_meeting_seq", "meeting_id", "seq"),
    )

    seq: Mapped[int] = mapped_column(BigInteger, Identity(always=True), nullable=False, unique=True)
    meeting_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    user: Mapped[User] = relationship(lazy="raise")
