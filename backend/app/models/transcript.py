import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import ARRAY, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin

# Must match the embedding model (BAAI/bge-small-en-v1.5 -> 384).
# Changing the model to one with another size needs a new migration.
EMBEDDING_DIM = 384


class TranscriptSegment(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """One timed piece of speech from one speaker."""

    __tablename__ = "transcript_segments"
    __table_args__ = (Index("ix_transcript_segments_meeting_start", "meeting_id", "start_ms"),)

    meeting_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False
    )
    recording_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("recordings.id", ondelete="SET NULL"))
    speaker_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    start_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    end_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)


class TranscriptChunk(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """A searchable piece of transcript with its embedding vector."""

    __tablename__ = "transcript_chunks"
    __table_args__ = (
        Index(
            "ix_transcript_chunks_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

    meeting_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), index=True, nullable=False
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    speaker_names: Mapped[list[str]] = mapped_column(ARRAY(String(100)), nullable=False, default=list)
    start_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    end_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM), nullable=False)


class MeetingSummary(Base):
    __tablename__ = "meeting_summaries"

    meeting_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    key_points: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    decisions: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
