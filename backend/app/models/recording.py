import enum
import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin, pg_enum


class RecordingStatus(str, enum.Enum):  # noqa: UP042
    UPLOADED = "uploaded"
    TRANSCRIBED = "transcribed"
    FAILED = "failed"


class Recording(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """One participant's microphone recording for one meeting."""

    __tablename__ = "recordings"

    meeting_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # Temporary path; the audio file is deleted after successful transcription.
    file_path: Mapped[str | None] = mapped_column(Text)
    mime_type: Mapped[str] = mapped_column(String(50), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    # Recording start time minus meeting start time, in milliseconds.
    offset_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[RecordingStatus] = mapped_column(
        pg_enum(RecordingStatus, "recording_status"),
        nullable=False,
        default=RecordingStatus.UPLOADED,
    )
    error: Mapped[str | None] = mapped_column(Text)
