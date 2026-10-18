import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.models import ActionItemSource, ActionItemStatus
from app.schemas.action_item import ActionItemCreate, ActionItemOut, ActionItemUpdate
from app.services import action_item_service
from app.services.action_item_service import ActionItemView

router = APIRouter(prefix="/action-items", tags=["Action items"])


def _out(view: ActionItemView) -> ActionItemOut:
    item = view.item
    return ActionItemOut(
        id=item.id,
        meeting_id=item.meeting_id,
        meeting_code=view.meeting_code,
        meeting_title=view.meeting_title,
        created_by_user_id=item.created_by_user_id,
        assignee_user_id=item.assignee_user_id,
        assignee_name=item.assignee_name,
        description=item.description,
        due_date=item.due_date,
        status=item.status,
        source=item.source,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("", response_model=list[ActionItemOut])
async def list_action_items(
    user: CurrentUser,
    db: DbSession,
    status_filter: Annotated[ActionItemStatus | None, Query(alias="status")] = None,
    meeting_code: Annotated[str | None, Query(alias="meetingCode")] = None,
) -> list[ActionItemOut]:
    views = await action_item_service.list_action_items(db, user.id, status_filter, meeting_code)
    return [_out(v) for v in views]


@router.post("", response_model=ActionItemOut, status_code=status.HTTP_201_CREATED)
async def create_action_item(data: ActionItemCreate, user: CurrentUser, db: DbSession) -> ActionItemOut:
    view = await action_item_service.create_action_item(
        db,
        user.id,
        data.description,
        ActionItemSource.MANUAL,
        meeting_code=data.meeting_code,
        assignee_name=data.assignee_name,
        due_date=data.due_date,
    )
    return _out(view)


@router.patch("/{item_id}", response_model=ActionItemOut)
async def update_action_item(
    item_id: uuid.UUID, data: ActionItemUpdate, user: CurrentUser, db: DbSession
) -> ActionItemOut:
    """Only the fields you send are changed (e.g. {"status": "done"})."""
    changes = data.model_dump(exclude_unset=True)
    view = await action_item_service.update_action_item(db, user.id, item_id, changes)
    return _out(view)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_action_item(item_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    await action_item_service.delete_action_item(db, user.id, item_id)
