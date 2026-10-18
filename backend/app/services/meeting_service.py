"""Meetings: create, join, leave, end, history and chat.

Access rule used everywhere: a user can see a meeting only if they have a row
in meeting_participants for it. Meetings the user cannot access return 404
(not 403), so other people's meeting codes are not revealed.
"""

import secrets
import string
import uuid
from datetime import datetime

from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.compat import UTC
from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    RateLimitError,
)
from app.core.rate_limit import limiter
from app.models import (
    ChatMessage,
    Meeting,
    MeetingParticipant,
    MeetingStatus,
    ParticipantRole,
    ProcessingStatus,
    User,
)
from app.schemas.meeting import MeetingCreate

MAX_CHAT_LENGTH = 2000
MEETING_LOOKUP_LIMIT = 20
MEETING_LOOKUP_WINDOW_S = 60
RATE_LIMIT_DETAIL = "Too many attempts, try again in a minute"


def _meeting_lookup_key(user_id: uuid.UUID) -> str:
    return f"meeting-code:{user_id}"


def _check_meeting_lookup_limit(user_id: uuid.UUID) -> None:
    if limiter.is_limited(_meeting_lookup_key(user_id), MEETING_LOOKUP_LIMIT, MEETING_LOOKUP_WINDOW_S):
        raise RateLimitError(RATE_LIMIT_DETAIL, headers={"Retry-After": "60"})


def _record_meeting_lookup_failure(user_id: uuid.UUID) -> None:
    if not limiter.hit(_meeting_lookup_key(user_id), MEETING_LOOKUP_LIMIT, MEETING_LOOKUP_WINDOW_S):
        raise RateLimitError(RATE_LIMIT_DETAIL, headers={"Retry-After": "60"})


def accessible_meeting_ids(user_id: uuid.UUID) -> Select:
    """Subquery: ids of meetings the user participated in."""
    return select(MeetingParticipant.meeting_id).where(MeetingParticipant.user_id == user_id)


def generate_meeting_code() -> str:
    """Readable code like 'abc-defg-hij'."""
    letters = string.ascii_lowercase
    parts = ("".join(secrets.choice(letters) for _ in range(n)) for n in (3, 4, 3))
    return "-".join(parts)


def normalize_code(code: str) -> str:
    return code.strip().lower()


async def create_meeting(db: AsyncSession, host: User, data: MeetingCreate) -> Meeting:
    for _ in range(5):  # retry on the (very unlikely) code collision
        meeting = Meeting(
            meeting_code=generate_meeting_code(),
            title=data.title.strip() or "Untitled meeting",
            host_id=host.id,
            status=MeetingStatus.SCHEDULED,
            recording_enabled=data.recording_enabled,
            processing_status=ProcessingStatus.NONE,
        )
        db.add(meeting)
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            continue
        db.add(
            MeetingParticipant(
                meeting_id=meeting.id,
                user_id=host.id,
                role=ParticipantRole.HOST,
                joined_at=datetime.now(UTC),
            )
        )
        await db.commit()
        await db.refresh(meeting)
        return meeting
    raise ConflictError("Could not generate a unique meeting code, please retry")


async def get_meeting_for_user(db: AsyncSession, user_id: uuid.UUID, code: str) -> Meeting:
    """Return the meeting only if the user is a participant (else 404)."""
    _check_meeting_lookup_limit(user_id)
    meeting = await db.scalar(
        select(Meeting).where(
            Meeting.meeting_code == normalize_code(code),
            Meeting.id.in_(accessible_meeting_ids(user_id)),
        )
    )
    if meeting is None:
        _record_meeting_lookup_failure(user_id)
        raise NotFoundError("Meeting not found")
    return meeting


async def join_meeting(db: AsyncSession, user_id: uuid.UUID, code: str) -> Meeting:
    """Anyone with the code can join a meeting that has not ended."""
    _check_meeting_lookup_limit(user_id)
    meeting = await db.scalar(select(Meeting).where(Meeting.meeting_code == normalize_code(code)))
    if meeting is None:
        _record_meeting_lookup_failure(user_id)
        raise NotFoundError("Meeting not found")
    if meeting.status == MeetingStatus.ENDED:
        raise BadRequestError("This meeting has already ended")

    now = datetime.now(UTC)
    participant = await db.scalar(
        select(MeetingParticipant).where(
            MeetingParticipant.meeting_id == meeting.id, MeetingParticipant.user_id == user_id
        )
    )
    if participant is None:
        db.add(
            MeetingParticipant(
                meeting_id=meeting.id,
                user_id=user_id,
                role=ParticipantRole.PARTICIPANT,
                joined_at=now,
            )
        )
    else:
        participant.joined_at = now
        participant.left_at = None

    if meeting.status == MeetingStatus.SCHEDULED:
        meeting.status = MeetingStatus.LIVE
        meeting.started_at = now

    try:
        await db.commit()
    except IntegrityError:  # two tabs joining at the same moment
        await db.rollback()
    await db.refresh(meeting)
    return meeting


async def leave_meeting(db: AsyncSession, user_id: uuid.UUID, meeting_id: uuid.UUID) -> None:
    participant = await db.scalar(
        select(MeetingParticipant).where(
            MeetingParticipant.meeting_id == meeting_id, MeetingParticipant.user_id == user_id
        )
    )
    if participant is not None and participant.left_at is None:
        participant.left_at = datetime.now(UTC)
        await db.commit()


async def end_meeting(db: AsyncSession, user: User, code: str) -> Meeting:
    """Host only. Marks the meeting ended and queues AI processing if recording was on."""
    meeting = await get_meeting_for_user(db, user.id, code)
    if meeting.host_id != user.id:
        raise ForbiddenError("Only the host can end the meeting")
    if meeting.status == MeetingStatus.ENDED:
        raise ConflictError("Meeting has already ended")

    now = datetime.now(UTC)
    meeting.status = MeetingStatus.ENDED
    meeting.ended_at = now
    if meeting.started_at is None:
        meeting.started_at = now
    if meeting.recording_enabled:
        meeting.processing_status = ProcessingStatus.PENDING
    await db.commit()
    await db.refresh(meeting)
    return meeting


async def list_meetings_for_user(
    db: AsyncSession, user_id: uuid.UUID, limit: int, offset: int
) -> tuple[list[Meeting], int]:
    base = select(Meeting).where(Meeting.id.in_(accessible_meeting_ids(user_id)))
    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    rows = await db.scalars(base.order_by(Meeting.created_at.desc()).limit(limit).offset(offset))
    return list(rows), int(total or 0)


async def list_participants(db: AsyncSession, meeting_id: uuid.UUID) -> list[MeetingParticipant]:
    rows = await db.scalars(
        select(MeetingParticipant)
        .options(selectinload(MeetingParticipant.user))
        .where(MeetingParticipant.meeting_id == meeting_id)
        .order_by(MeetingParticipant.joined_at)
    )
    return list(rows)


async def add_chat_message(
    db: AsyncSession, meeting_id: uuid.UUID, user_id: uuid.UUID, content: str
) -> ChatMessage:
    content = content.strip()
    if not content:
        raise BadRequestError("Message cannot be empty")
    if len(content) > MAX_CHAT_LENGTH:
        raise BadRequestError(f"Message is longer than {MAX_CHAT_LENGTH} characters")
    message = ChatMessage(meeting_id=meeting_id, user_id=user_id, content=content)
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


async def list_chat_messages(db: AsyncSession, meeting_id: uuid.UUID, limit: int = 200) -> list[ChatMessage]:
    rows = await db.scalars(
        select(ChatMessage)
        .options(selectinload(ChatMessage.user))
        .where(ChatMessage.meeting_id == meeting_id)
        .order_by(ChatMessage.seq.desc())
        .limit(limit)
    )
    return list(reversed(list(rows)))
