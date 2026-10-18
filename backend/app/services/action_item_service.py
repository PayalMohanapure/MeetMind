"""Action items.

Visibility: items linked to a meeting are visible to all its participants;
items without a meeting are visible only to the user who created them.
"""

import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy import Select, and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models import ActionItem, ActionItemSource, ActionItemStatus, Meeting
from app.services.meeting_service import accessible_meeting_ids, get_meeting_for_user


@dataclass
class ActionItemView:
    item: ActionItem
    meeting_code: str | None
    meeting_title: str | None


def _visible_items(user_id: uuid.UUID) -> Select:
    return (
        select(ActionItem, Meeting.meeting_code, Meeting.title)
        .outerjoin(Meeting, Meeting.id == ActionItem.meeting_id)
        .where(
            or_(
                ActionItem.meeting_id.in_(accessible_meeting_ids(user_id)),
                and_(ActionItem.meeting_id.is_(None), ActionItem.created_by_user_id == user_id),
            )
        )
    )


async def list_action_items(
    db: AsyncSession,
    user_id: uuid.UUID,
    status: ActionItemStatus | None = None,
    meeting_code: str | None = None,
    limit: int = 100,
) -> list[ActionItemView]:
    stmt = _visible_items(user_id)
    if status is not None:
        stmt = stmt.where(ActionItem.status == status)
    if meeting_code:
        meeting = await get_meeting_for_user(db, user_id, meeting_code)
        stmt = stmt.where(ActionItem.meeting_id == meeting.id)
    rows = await db.execute(
        stmt.order_by(ActionItem.status, ActionItem.due_date.nulls_last(), ActionItem.created_at).limit(limit)
    )
    return [ActionItemView(item, code, title) for item, code, title in rows]


async def get_action_item(db: AsyncSession, user_id: uuid.UUID, item_id: uuid.UUID) -> ActionItemView:
    row = (await db.execute(_visible_items(user_id).where(ActionItem.id == item_id))).first()
    if row is None:
        raise NotFoundError("Action item not found")
    item, code, title = row
    return ActionItemView(item, code, title)


async def create_action_item(
    db: AsyncSession,
    user_id: uuid.UUID,
    description: str,
    source: ActionItemSource,
    meeting_code: str | None = None,
    assignee_name: str | None = None,
    due_date: date | None = None,
) -> ActionItemView:
    meeting = await get_meeting_for_user(db, user_id, meeting_code) if meeting_code else None
    item = ActionItem(
        meeting_id=meeting.id if meeting else None,
        created_by_user_id=user_id,
        assignee_name=(assignee_name or "").strip() or None,
        description=description.strip(),
        due_date=due_date,
        status=ActionItemStatus.OPEN,
        source=source,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return ActionItemView(item, meeting.meeting_code if meeting else None, meeting.title if meeting else None)


async def update_action_item(
    db: AsyncSession, user_id: uuid.UUID, item_id: uuid.UUID, changes: dict
) -> ActionItemView:
    view = await get_action_item(db, user_id, item_id)
    for field in ("description", "assignee_name", "due_date", "status"):
        if field in changes:
            setattr(view.item, field, changes[field])
    view.item.user_modified = True
    await db.commit()
    await db.refresh(view.item)
    return view


async def delete_action_item(db: AsyncSession, user_id: uuid.UUID, item_id: uuid.UUID) -> None:
    view = await get_action_item(db, user_id, item_id)
    await db.delete(view.item)
    await db.commit()
