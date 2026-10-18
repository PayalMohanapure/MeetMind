import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status
from sqlalchemy import select

from app.agent import service as agent_service
from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.rate_limit import SlidingWindowRateLimiter
from app.models import AgentConversation, AgentMessage
from app.schemas.agent import (
    AgentChatRequest,
    AgentChatResponse,
    AgentMessageOut,
    ConversationDetail,
    ConversationOut,
)

router = APIRouter(prefix="/agent", tags=["AI assistant (agent)"])

rate_limiter = SlidingWindowRateLimiter(settings.agent_rate_limit_per_minute, 60)


@router.post("/chat", response_model=AgentChatResponse)
async def chat(data: AgentChatRequest, user: CurrentUser, db: DbSession) -> AgentChatResponse:
    """Ask MeetMind. The agent decides which tools to use (search, summaries, tasks, email drafts)."""
    rate_limiter.check(str(user.id))
    return await agent_service.chat(db, user, data.message, data.conversation_id)


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    user: CurrentUser, db: DbSession, limit: Annotated[int, Query(ge=1, le=100)] = 30
) -> list[ConversationOut]:
    rows = await db.scalars(
        select(AgentConversation)
        .where(AgentConversation.user_id == user.id)
        .order_by(AgentConversation.created_at.desc())
        .limit(limit)
    )
    return [ConversationOut.model_validate(c) for c in rows]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: uuid.UUID, user: CurrentUser, db: DbSession
) -> ConversationDetail:
    conversation = await agent_service.get_conversation(db, user.id, conversation_id)
    messages = await db.scalars(
        select(AgentMessage).where(AgentMessage.conversation_id == conversation.id).order_by(AgentMessage.seq)
    )
    return ConversationDetail(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        messages=[AgentMessageOut.model_validate(m) for m in messages],
    )


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(conversation_id: uuid.UUID, user: CurrentUser, db: DbSession) -> None:
    conversation = await agent_service.get_conversation(db, user.id, conversation_id)
    await db.delete(conversation)
    await db.commit()
