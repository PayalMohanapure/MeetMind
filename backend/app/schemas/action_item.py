import uuid
from datetime import date, datetime

from pydantic import Field, field_validator

from app.models import ActionItemSource, ActionItemStatus
from app.schemas.common import CamelModel


class ActionItemCreate(CamelModel):
    description: str = Field(min_length=3, max_length=1000)
    meeting_code: str | None = None
    assignee_name: str | None = Field(default=None, max_length=100)
    due_date: date | None = None

    @field_validator("description", mode="before")
    @classmethod
    def _strip_description(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class ActionItemUpdate(CamelModel):
    description: str | None = Field(default=None, min_length=3, max_length=1000)
    assignee_name: str | None = Field(default=None, max_length=100)
    due_date: date | None = None
    status: ActionItemStatus | None = None

    @field_validator("description", mode="before")
    @classmethod
    def _strip_description(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class ActionItemOut(CamelModel):
    id: uuid.UUID
    meeting_id: uuid.UUID | None
    meeting_code: str | None
    meeting_title: str | None
    created_by_user_id: uuid.UUID
    assignee_user_id: uuid.UUID | None
    assignee_name: str | None
    description: str
    due_date: date | None
    status: ActionItemStatus
    source: ActionItemSource
    created_at: datetime
    updated_at: datetime
