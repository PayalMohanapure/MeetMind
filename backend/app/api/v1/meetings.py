from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query, status

from app.ai import pipeline
from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.models import Meeting, ProcessingStatus
from app.realtime.socket_server import notify_meeting_ended
from app.schemas.common import Page
from app.schemas.meeting import (
    ChatMessageOut,
    MeetingCreate,
    MeetingDetail,
    MeetingOut,
    ParticipantOut,
)
from app.services import meeting_service

router = APIRouter(prefix="/meetings", tags=["Meetings"])


async def _detail(db, meeting: Meeting, user_id) -> MeetingDetail:
    participants = await meeting_service.list_participants(db, meeting.id)
    return MeetingDetail(
        **MeetingOut.model_validate(meeting).model_dump(),
        is_host=meeting.host_id == user_id,
        participants=[
            ParticipantOut(
                user_id=p.user_id,
                full_name=p.user.full_name,
                username=p.user.username,
                role=p.role,
                joined_at=p.joined_at,
                left_at=p.left_at,
            )
            for p in participants
        ],
    )


@router.post("", response_model=MeetingDetail, status_code=status.HTTP_201_CREATED)
async def create_meeting(data: MeetingCreate, user: CurrentUser, db: DbSession) -> MeetingDetail:
    """Create a meeting. The creator becomes the host."""
    meeting = await meeting_service.create_meeting(db, user, data)
    return await _detail(db, meeting, user.id)


@router.get("", response_model=Page[MeetingOut])
async def list_meetings(
    user: CurrentUser,
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[MeetingOut]:
    """Meeting history: every meeting you hosted or joined, newest first."""
    items, total = await meeting_service.list_meetings_for_user(db, user.id, limit, offset)
    return Page[MeetingOut](
        items=[MeetingOut.model_validate(m) for m in items], total=total, limit=limit, offset=offset
    )


@router.get("/{code}", response_model=MeetingDetail)
async def get_meeting(code: str, user: CurrentUser, db: DbSession) -> MeetingDetail:
    meeting = await meeting_service.get_meeting_for_user(db, user.id, code)
    return await _detail(db, meeting, user.id)


@router.post("/{code}/join", response_model=MeetingDetail)
async def join_meeting(code: str, user: CurrentUser, db: DbSession) -> MeetingDetail:
    """Join with a meeting code. The first join starts the meeting."""
    meeting = await meeting_service.join_meeting(db, user.id, code)
    return await _detail(db, meeting, user.id)


@router.post("/{code}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_meeting(code: str, user: CurrentUser, db: DbSession) -> None:
    meeting = await meeting_service.get_meeting_for_user(db, user.id, code)
    await meeting_service.leave_meeting(db, user.id, meeting.id)


@router.post("/{code}/end", response_model=MeetingOut)
async def end_meeting(
    code: str, user: CurrentUser, db: DbSession, background_tasks: BackgroundTasks
) -> MeetingOut:
    """Host only. Ends the call for everyone and starts AI processing if recording was on."""
    meeting = await meeting_service.end_meeting(db, user, code)
    await notify_meeting_ended(meeting.meeting_code)
    if meeting.processing_status == ProcessingStatus.PENDING:
        background_tasks.add_task(
            pipeline.process_meeting_after_delay, meeting.id, settings.processing_delay_seconds
        )
    return MeetingOut.model_validate(meeting)


@router.get("/{code}/chat", response_model=list[ChatMessageOut])
async def chat_history(
    code: str,
    user: CurrentUser,
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> list[ChatMessageOut]:
    meeting = await meeting_service.get_meeting_for_user(db, user.id, code)
    messages = await meeting_service.list_chat_messages(db, meeting.id, limit)
    return [
        ChatMessageOut(
            id=m.id,
            user_id=m.user_id,
            sender_name=m.user.full_name,
            content=m.content,
            created_at=m.created_at,
        )
        for m in messages
    ]
