"""Initial schema: users, auth, meetings, recordings, transcripts (pgvector), AI and agent tables.

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

EMBEDDING_DIM = 384

ENUMS = {
    "meeting_status": ("scheduled", "live", "ended"),
    "processing_status": (
        "none", "pending", "transcribing", "embedding", "summarizing", "done", "failed",
    ),
    "participant_role": ("host", "participant"),
    "recording_status": ("uploaded", "transcribed", "failed"),
    "action_item_status": ("open", "done"),
    "action_item_source": ("ai_extracted", "agent", "manual"),
    "message_role": ("user", "assistant", "tool"),
}


def _enum(name: str) -> postgresql.ENUM:
    # create_type=False: types are created explicitly at the start of upgrade().
    return postgresql.ENUM(*ENUMS[name], name=name, create_type=False)


def _id() -> sa.Column:
    return sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False)


def _created_at() -> sa.Column:
    return sa.Column(
        "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
    )


def _updated_at() -> sa.Column:
    return sa.Column(
        "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
    )


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    bind = op.get_bind()
    for name, values in ENUMS.items():
        postgresql.ENUM(*values, name=name).create(bind, checkfirst=True)

    # --- users & auth -------------------------------------------------------
    op.create_table(
        "users",
        _id(),
        sa.Column("full_name", sa.String(100), nullable=False),
        sa.Column("username", sa.String(50), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        _created_at(),
        _updated_at(),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.UniqueConstraint("username", name="uq_users_username"),
    )

    op.create_table(
        "refresh_tokens",
        _id(),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        _created_at(),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_refresh_tokens_user_id_users", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_refresh_tokens"),
        sa.UniqueConstraint("token_hash", name="uq_refresh_tokens_token_hash"),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])

    # --- meetings ------------------------------------------------------------
    op.create_table(
        "meetings",
        _id(),
        sa.Column("meeting_code", sa.String(12), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("host_id", sa.UUID(), nullable=False),
        sa.Column("status", _enum("meeting_status"), nullable=False),
        sa.Column("recording_enabled", sa.Boolean(), nullable=False),
        sa.Column("processing_status", _enum("processing_status"), nullable=False),
        sa.Column("processing_error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        _created_at(),
        sa.ForeignKeyConstraint(
            ["host_id"], ["users.id"], name="fk_meetings_host_id_users", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_meetings"),
        sa.UniqueConstraint("meeting_code", name="uq_meetings_meeting_code"),
    )
    op.create_index("ix_meetings_host_id", "meetings", ["host_id"])

    op.create_table(
        "meeting_participants",
        _id(),
        sa.Column("meeting_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("role", _enum("participant_role"), nullable=False),
        sa.Column(
            "joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["meeting_id"], ["meetings.id"],
            name="fk_meeting_participants_meeting_id_meetings", ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"],
            name="fk_meeting_participants_user_id_users", ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_meeting_participants"),
        sa.UniqueConstraint("meeting_id", "user_id", name="uq_meeting_participants_meeting_user"),
    )
    op.create_index("ix_meeting_participants_user_id", "meeting_participants", ["user_id"])

    op.create_table(
        "chat_messages",
        _id(),
        sa.Column("meeting_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        _created_at(),
        sa.ForeignKeyConstraint(
            ["meeting_id"], ["meetings.id"],
            name="fk_chat_messages_meeting_id_meetings", ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_chat_messages_user_id_users", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_chat_messages"),
    )
    op.create_index(
        "ix_chat_messages_meeting_created", "chat_messages", ["meeting_id", "created_at"]
    )

    # --- recordings & transcripts --------------------------------------------
    op.create_table(
        "recordings",
        _id(),
        sa.Column("meeting_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=True),
        sa.Column("mime_type", sa.String(50), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("offset_ms", sa.Integer(), nullable=False),
        sa.Column("status", _enum("recording_status"), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        _created_at(),
        sa.ForeignKeyConstraint(
            ["meeting_id"], ["meetings.id"],
            name="fk_recordings_meeting_id_meetings", ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_recordings_user_id_users", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_recordings"),
    )
    op.create_index("ix_recordings_meeting_id", "recordings", ["meeting_id"])

    op.create_table(
        "transcript_segments",
        _id(),
        sa.Column("meeting_id", sa.UUID(), nullable=False),
        sa.Column("recording_id", sa.UUID(), nullable=True),
        sa.Column("speaker_user_id", sa.UUID(), nullable=False),
        sa.Column("start_ms", sa.Integer(), nullable=False),
        sa.Column("end_ms", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        _created_at(),
        sa.ForeignKeyConstraint(
            ["meeting_id"], ["meetings.id"],
            name="fk_transcript_segments_meeting_id_meetings", ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["recording_id"], ["recordings.id"],
            name="fk_transcript_segments_recording_id_recordings", ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["speaker_user_id"], ["users.id"],
            name="fk_transcript_segments_speaker_user_id_users", ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_transcript_segments"),
    )
    op.create_index(
        "ix_transcript_segments_meeting_start", "transcript_segments", ["meeting_id", "start_ms"]
    )

    op.create_table(
        "transcript_chunks",
        _id(),
        sa.Column("meeting_id", sa.UUID(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("speaker_names", sa.ARRAY(sa.String(100)), nullable=False),
        sa.Column("start_ms", sa.Integer(), nullable=False),
        sa.Column("end_ms", sa.Integer(), nullable=False),
        sa.Column("embedding", Vector(EMBEDDING_DIM), nullable=False),
        _created_at(),
        sa.ForeignKeyConstraint(
            ["meeting_id"], ["meetings.id"],
            name="fk_transcript_chunks_meeting_id_meetings", ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_transcript_chunks"),
    )
    op.create_index("ix_transcript_chunks_meeting_id", "transcript_chunks", ["meeting_id"])
    # Approximate nearest-neighbour index for cosine similarity search.
    op.create_index(
        "ix_transcript_chunks_embedding_hnsw",
        "transcript_chunks",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_with={"m": 16, "ef_construction": 64},
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )

    op.create_table(
        "meeting_summaries",
        sa.Column("meeting_id", sa.UUID(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("key_points", postgresql.JSONB(), nullable=False),
        sa.Column("decisions", postgresql.JSONB(), nullable=False),
        sa.Column("model_name", sa.String(100), nullable=False),
        _created_at(),
        sa.ForeignKeyConstraint(
            ["meeting_id"], ["meetings.id"],
            name="fk_meeting_summaries_meeting_id_meetings", ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("meeting_id", name="pk_meeting_summaries"),
    )

    op.create_table(
        "action_items",
        _id(),
        sa.Column("meeting_id", sa.UUID(), nullable=True),
        sa.Column("created_by_user_id", sa.UUID(), nullable=False),
        sa.Column("assignee_user_id", sa.UUID(), nullable=True),
        sa.Column("assignee_name", sa.String(100), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("status", _enum("action_item_status"), nullable=False),
        sa.Column("source", _enum("action_item_source"), nullable=False),
        _created_at(),
        _updated_at(),
        sa.ForeignKeyConstraint(
            ["meeting_id"], ["meetings.id"],
            name="fk_action_items_meeting_id_meetings", ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"], ["users.id"],
            name="fk_action_items_created_by_user_id_users", ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["assignee_user_id"], ["users.id"],
            name="fk_action_items_assignee_user_id_users", ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_action_items"),
    )
    op.create_index("ix_action_items_meeting_id", "action_items", ["meeting_id"])
    op.create_index("ix_action_items_created_by_user_id", "action_items", ["created_by_user_id"])

    # --- agent -----------------------------------------------------------------
    op.create_table(
        "agent_conversations",
        _id(),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        _created_at(),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"],
            name="fk_agent_conversations_user_id_users", ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_agent_conversations"),
    )
    op.create_index("ix_agent_conversations_user_id", "agent_conversations", ["user_id"])

    op.create_table(
        "agent_messages",
        _id(),
        sa.Column("conversation_id", sa.UUID(), nullable=False),
        sa.Column("role", _enum("message_role"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("tool_name", sa.String(100), nullable=True),
        sa.Column("sources", postgresql.JSONB(), nullable=True),
        _created_at(),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["agent_conversations.id"],
            name="fk_agent_messages_conversation_id_agent_conversations", ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_agent_messages"),
    )
    op.create_index(
        "ix_agent_messages_conversation_created",
        "agent_messages",
        ["conversation_id", "created_at"],
    )


def downgrade() -> None:
    # Drop in reverse dependency order (indexes are dropped with their tables).
    for table in (
        "agent_messages",
        "agent_conversations",
        "action_items",
        "meeting_summaries",
        "transcript_chunks",
        "transcript_segments",
        "recordings",
        "chat_messages",
        "meeting_participants",
        "meetings",
        "refresh_tokens",
        "users",
    ):
        op.drop_table(table)

    bind = op.get_bind()
    for name in ENUMS:
        postgresql.ENUM(name=name).drop(bind, checkfirst=True)
    # The "vector" extension is left installed on purpose (other databases may use it).
