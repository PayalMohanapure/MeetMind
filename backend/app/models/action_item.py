import enum
import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, pg_enum


class ActionItemStatus(str, enum.Enum):  # noqa: UP042
    OPEN = "open"
    DONE = "done"


class ActionItemSource(str, enum.Enum):  # noqa: UP042
    AI_EXTRACTED = "ai_extracted"
    AGENT = "agent"
    MANUAL = "manual"


class ActionItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "action_items"

    # Null for general items not linked to a meeting.
    meeting_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), index=True
    )
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    assignee_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    assignee_name: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[ActionItemStatus] = mapped_column(
        pg_enum(ActionItemStatus, "action_item_status"),
        nullable=False,
        default=ActionItemStatus.OPEN,
    )
    user_modified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    source: Mapped[ActionItemSource] = mapped_column(
        pg_enum(ActionItemSource, "action_item_source"), nullable=False
    )
