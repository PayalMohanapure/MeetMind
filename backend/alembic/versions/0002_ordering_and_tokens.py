"""M1: refresh-token families, message ordering, and edited action items.

Revision ID: 0002_ordering_and_tokens
Revises: 0001_initial
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_ordering_and_tokens"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "refresh_tokens",
        sa.Column(
            "family_id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
    )
    op.add_column("refresh_tokens", sa.Column("replaced_by_id", postgresql.UUID(as_uuid=True)))
    op.add_column("refresh_tokens", sa.Column("last_used_at", sa.DateTime(timezone=True)))
    op.add_column("refresh_tokens", sa.Column("user_agent", sa.String(length=300)))
    op.add_column("refresh_tokens", sa.Column("ip", sa.String(length=64)))
    op.create_foreign_key(
        "fk_refresh_tokens_replaced_by_id_refresh_tokens",
        "refresh_tokens",
        "refresh_tokens",
        ["replaced_by_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_refresh_tokens_family_id", "refresh_tokens", ["family_id"])

    op.add_column(
        "agent_messages",
        sa.Column("seq", sa.BigInteger(), sa.Identity(always=True), nullable=False),
    )
    op.create_unique_constraint("uq_agent_messages_seq", "agent_messages", ["seq"])
    op.create_index(
        "ix_agent_messages_conversation_seq",
        "agent_messages",
        ["conversation_id", "seq"],
    )

    op.add_column(
        "chat_messages",
        sa.Column("seq", sa.BigInteger(), sa.Identity(always=True), nullable=False),
    )
    op.create_unique_constraint("uq_chat_messages_seq", "chat_messages", ["seq"])
    op.create_index("ix_chat_messages_meeting_seq", "chat_messages", ["meeting_id", "seq"])

    op.add_column(
        "action_items",
        sa.Column("user_modified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("action_items", "user_modified")

    op.drop_index("ix_chat_messages_meeting_seq", table_name="chat_messages")
    op.drop_constraint("uq_chat_messages_seq", "chat_messages", type_="unique")
    op.drop_column("chat_messages", "seq")

    op.drop_index("ix_agent_messages_conversation_seq", table_name="agent_messages")
    op.drop_constraint("uq_agent_messages_seq", "agent_messages", type_="unique")
    op.drop_column("agent_messages", "seq")

    op.drop_index("ix_refresh_tokens_family_id", table_name="refresh_tokens")
    op.drop_constraint(
        "fk_refresh_tokens_replaced_by_id_refresh_tokens",
        "refresh_tokens",
        type_="foreignkey",
    )
    op.drop_column("refresh_tokens", "ip")
    op.drop_column("refresh_tokens", "user_agent")
    op.drop_column("refresh_tokens", "last_used_at")
    op.drop_column("refresh_tokens", "replaced_by_id")
    op.drop_column("refresh_tokens", "family_id")
