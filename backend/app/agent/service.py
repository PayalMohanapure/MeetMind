"""Runs the MeetMind agent for one chat message and stores the conversation.

The agent is a LangChain v1 `create_agent` graph (built on LangGraph): a
ReAct-style loop where the LLM either calls tools or gives a final answer.
"""

import logging
import uuid
from datetime import datetime

from langchain.agents import create_agent
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage
from langgraph.errors import GraphRecursionError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.prompts import build_system_prompt
from app.agent.tools import ToolContext, build_tools
from app.ai import providers
from app.core.compat import UTC
from app.core.config import settings
from app.core.exceptions import AppError, NotFoundError, ServiceUnavailableError
from app.db.session import SessionLocal
from app.models import AgentConversation, AgentMessage, MessageRole, User
from app.schemas.agent import AgentChatResponse, SourceOut

logger = logging.getLogger(__name__)

STEP_LIMIT_REPLY = "I couldn't finish that within my step limit. Please ask a more specific question."


async def get_conversation(
    db: AsyncSession, user_id: uuid.UUID, conversation_id: uuid.UUID
) -> AgentConversation:
    conversation = await db.scalar(
        select(AgentConversation).where(
            AgentConversation.id == conversation_id, AgentConversation.user_id == user_id
        )
    )
    if conversation is None:
        raise NotFoundError("Conversation not found")
    return conversation


async def _history(db: AsyncSession, conversation_id: uuid.UUID) -> list[BaseMessage]:
    """Last N user/assistant messages, oldest first (tool messages are not replayed)."""
    rows = await db.scalars(
        select(AgentMessage)
        .where(
            AgentMessage.conversation_id == conversation_id,
            AgentMessage.role.in_([MessageRole.USER, MessageRole.ASSISTANT]),
        )
        .order_by(AgentMessage.seq.desc())
        .limit(settings.agent_history_messages)
    )
    messages: list[BaseMessage] = []
    for m in reversed(list(rows)):
        messages.append(HumanMessage(m.content) if m.role == MessageRole.USER else AIMessage(m.content))
    return messages


def _text(message: BaseMessage) -> str:
    content = message.content
    if isinstance(content, str):
        return content.strip()
    # Some providers return a list of content blocks.
    return " ".join(block.get("text", "") for block in content if isinstance(block, dict)).strip()


async def chat(
    db: AsyncSession, user: User, message: str, conversation_id: uuid.UUID | None
) -> AgentChatResponse:
    if conversation_id:
        conversation = await get_conversation(db, user.id, conversation_id)
    else:
        conversation = AgentConversation(user_id=user.id, title=message.strip()[:60])
        db.add(conversation)
        await db.flush()

    user_message = AgentMessage(conversation_id=conversation.id, role=MessageRole.USER, content=message)
    db.add(user_message)
    await db.commit()
    await db.refresh(user_message)

    history = await _history(db, conversation.id)
    context = ToolContext(user_id=user.id, session_factory=SessionLocal, top_k=settings.retrieval_top_k)
    try:
        model = providers.get_chat_model()
    except AppError:
        await db.rollback()
        raise

    agent = create_agent(
        model,
        tools=build_tools(context),
        system_prompt=build_system_prompt(user.full_name, datetime.now(UTC).date()),
    )
    inputs = [*history, HumanMessage(message)]

    try:
        result = await agent.ainvoke(
            {"messages": inputs},
            config={"recursion_limit": settings.agent_max_steps * 2 + 1},
        )
        new_messages: list[BaseMessage] = result["messages"][len(inputs) :]
    except GraphRecursionError:
        new_messages = [AIMessage(STEP_LIMIT_REPLY)]
    except AppError:
        await db.rollback()
        raise
    except Exception as exc:
        logger.exception("Agent run failed")
        raise ServiceUnavailableError("The AI assistant is unavailable right now. Please try again.") from exc

    tool_messages = [m for m in new_messages if isinstance(m, ToolMessage)]
    final = next((m for m in reversed(new_messages) if isinstance(m, AIMessage) and _text(m)), None)
    reply = _text(final) if final else "I could not produce an answer. Please rephrase your question."

    for tm in tool_messages:
        db.add(
            AgentMessage(
                conversation_id=conversation.id,
                role=MessageRole.TOOL,
                tool_name=tm.name,
                content=_text(tm)[:4000],
            )
        )
    db.add(
        AgentMessage(
            conversation_id=conversation.id,
            role=MessageRole.ASSISTANT,
            content=reply,
            sources=context.sources or None,
        )
    )
    await db.commit()

    tools_used: list[str] = []
    for tm in tool_messages:
        if tm.name and tm.name not in tools_used:
            tools_used.append(tm.name)

    return AgentChatResponse(
        conversation_id=conversation.id,
        reply=reply,
        sources=[SourceOut.model_validate(s) for s in context.sources],
        tools_used=tools_used,
    )
