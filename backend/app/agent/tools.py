"""Tools the agent can call.

Security design: `build_tools(context)` creates the tools for ONE request with
the current user's id captured in a closure. The LLM chooses the tool and its
arguments, but it can never choose whose data is read; every query is scoped to
`context.user_id`.

Each tool opens its own database session because the agent may run several
tool calls at the same time, and one AsyncSession must not be shared between
concurrent tasks.
"""

import json
import uuid
from dataclasses import dataclass, field
from datetime import date

from langchain_core.tools import BaseTool, StructuredTool
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.ai import retrieval
from app.ai.timefmt import format_timestamp
from app.core.exceptions import AppError
from app.models import ActionItemSource, ActionItemStatus, MeetingSummary
from app.services import action_item_service, meeting_service


@dataclass
class ToolContext:
    user_id: uuid.UUID
    session_factory: async_sessionmaker[AsyncSession]
    top_k: int = 6
    sources: list[dict] = field(default_factory=list)

    def add_source(self, source: dict) -> None:
        key = (source.get("meetingId"), source.get("chunkId"))
        if all((s.get("meetingId"), s.get("chunkId")) != key for s in self.sources):
            self.sources.append(source)


def _json(data) -> str:
    return json.dumps(data, ensure_ascii=False, default=str)


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


# --- Argument schemas (their descriptions are shown to the LLM) -------------------


class SearchMeetingsArgs(BaseModel):
    query: str = Field(description="What to look for, in natural language")
    meeting_code: str | None = Field(default=None, description="Limit to one meeting code")
    date_from: str | None = Field(default=None, description="Start date YYYY-MM-DD")
    date_to: str | None = Field(default=None, description="End date YYYY-MM-DD")


class MeetingCodeArgs(BaseModel):
    meeting_code: str = Field(description="Meeting code, e.g. abc-defg-hij")


class ListActionItemsArgs(BaseModel):
    status: str | None = Field(default=None, description="'open' or 'done'; omit for all")
    meeting_code: str | None = Field(default=None, description="Only items from this meeting")


class CreateActionItemArgs(BaseModel):
    description: str = Field(description="What needs to be done")
    assignee_name: str | None = Field(default=None, description="Who should do it")
    due_date: str | None = Field(default=None, description="Deadline YYYY-MM-DD")
    meeting_code: str | None = Field(default=None, description="Meeting it belongs to")


def build_tools(ctx: ToolContext) -> list[BaseTool]:
    async def search_meetings(
        query: str,
        meeting_code: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> str:
        async with ctx.session_factory() as db:
            try:
                hits = await retrieval.search_chunks(
                    db,
                    ctx.user_id,
                    query,
                    top_k=ctx.top_k,
                    meeting_code=meeting_code,
                    date_from=_parse_date(date_from),
                    date_to=_parse_date(date_to),
                )
            except AppError as exc:
                return _json({"error": exc.detail})
        if not hits:
            return _json({"results": [], "note": "No matching transcript passages found."})
        results = []
        for h in hits:
            ctx.add_source(
                {
                    "meetingId": str(h.meeting_id),
                    "meetingCode": h.meeting_code,
                    "meetingTitle": h.meeting_title,
                    "chunkId": str(h.chunk_id),
                    "startMs": h.start_ms,
                    "timestamp": format_timestamp(h.start_ms),
                }
            )
            results.append(
                {
                    "meetingTitle": h.meeting_title,
                    "meetingCode": h.meeting_code,
                    "meetingDate": h.meeting_date.date().isoformat() if h.meeting_date else None,
                    "timestamp": format_timestamp(h.start_ms),
                    "relevance": h.score,
                    "transcript": h.content,
                }
            )
        return _json({"results": results})

    async def get_meeting_summary(meeting_code: str) -> str:
        async with ctx.session_factory() as db:
            try:
                meeting = await meeting_service.get_meeting_for_user(db, ctx.user_id, meeting_code)
            except AppError as exc:
                return _json({"error": exc.detail})
            summary = await db.get(MeetingSummary, meeting.id)
            participants = await meeting_service.list_participants(db, meeting.id)
        ctx.add_source(
            {
                "meetingId": str(meeting.id),
                "meetingCode": meeting.meeting_code,
                "meetingTitle": meeting.title,
                "chunkId": None,
                "startMs": None,
                "timestamp": None,
            }
        )
        data = {
            "meetingTitle": meeting.title,
            "meetingCode": meeting.meeting_code,
            "date": meeting.started_at.date().isoformat() if meeting.started_at else None,
            "participants": [p.user.full_name for p in participants],
            "processingStatus": meeting.processing_status.value,
        }
        if summary is None:
            data["note"] = "No summary is available for this meeting yet."
        else:
            data.update(summary=summary.summary, keyPoints=summary.key_points, decisions=summary.decisions)
        return _json(data)

    async def list_action_items(status: str | None = None, meeting_code: str | None = None) -> str:
        status_enum = None
        if status:
            try:
                status_enum = ActionItemStatus(status.lower())
            except ValueError:
                return _json({"error": "status must be 'open' or 'done'"})
        async with ctx.session_factory() as db:
            try:
                views = await action_item_service.list_action_items(
                    db, ctx.user_id, status_enum, meeting_code, limit=50
                )
            except AppError as exc:
                return _json({"error": exc.detail})
        return _json(
            {
                "actionItems": [
                    {
                        "description": v.item.description,
                        "assignee": v.item.assignee_name,
                        "dueDate": v.item.due_date,
                        "status": v.item.status.value,
                        "meetingTitle": v.meeting_title,
                        "meetingCode": v.meeting_code,
                    }
                    for v in views
                ]
            }
        )

    async def create_action_item(
        description: str,
        assignee_name: str | None = None,
        due_date: str | None = None,
        meeting_code: str | None = None,
    ) -> str:
        async with ctx.session_factory() as db:
            try:
                view = await action_item_service.create_action_item(
                    db,
                    ctx.user_id,
                    description,
                    ActionItemSource.AGENT,
                    meeting_code=meeting_code,
                    assignee_name=assignee_name,
                    due_date=_parse_date(due_date),
                )
            except AppError as exc:
                return _json({"error": exc.detail})
        return _json(
            {
                "created": True,
                "id": str(view.item.id),
                "description": view.item.description,
                "assignee": view.item.assignee_name,
                "dueDate": view.item.due_date,
                "meetingTitle": view.meeting_title,
            }
        )

    async def draft_followup_email(meeting_code: str) -> str:
        async with ctx.session_factory() as db:
            try:
                meeting = await meeting_service.get_meeting_for_user(db, ctx.user_id, meeting_code)
            except AppError as exc:
                return _json({"error": exc.detail})
            summary = await db.get(MeetingSummary, meeting.id)
            items = await action_item_service.list_action_items(
                db, ctx.user_id, meeting_code=meeting.meeting_code
            )
            participants = await meeting_service.list_participants(db, meeting.id)
        if summary is None:
            return _json({"error": "This meeting has no summary yet, so no draft can be made."})

        when = meeting.started_at.date().isoformat() if meeting.started_at else "our meeting"
        lines = [
            f"Subject: Follow-up: {meeting.title} ({when})",
            "",
            "Hi all,",
            "",
            "Thanks for joining. Here is a quick recap.",
            "",
            summary.summary,
            "",
        ]
        if summary.decisions:
            lines += ["Decisions:"] + [f"- {d}" for d in summary.decisions] + [""]
        open_items = [v.item for v in items if v.item.status == ActionItemStatus.OPEN]
        if open_items:
            lines.append("Action items:")
            for item in open_items:
                owner = f" ({item.assignee_name})" if item.assignee_name else ""
                due = f", due {item.due_date.isoformat()}" if item.due_date else ""
                lines.append(f"- {item.description}{owner}{due}")
            lines.append("")
        lines += ["Let me know if I missed anything.", "", "Best regards"]
        return _json(
            {
                "draft": "\n".join(lines),
                "recipients": [p.user.full_name for p in participants],
                "note": "Draft only. It has not been sent.",
            }
        )

    return [
        StructuredTool.from_function(
            coroutine=search_meetings,
            name="search_meetings",
            description=(
                "Semantic search over the transcripts of the user's meetings. Use it to answer "
                "questions about what was said, decided or discussed."
            ),
            args_schema=SearchMeetingsArgs,
        ),
        StructuredTool.from_function(
            coroutine=get_meeting_summary,
            name="get_meeting_summary",
            description="Get the AI summary, key points, decisions and participants of one meeting.",
            args_schema=MeetingCodeArgs,
        ),
        StructuredTool.from_function(
            coroutine=list_action_items,
            name="list_action_items",
            description="List the user's action items (tasks), optionally filtered by status or meeting.",
            args_schema=ListActionItemsArgs,
        ),
        StructuredTool.from_function(
            coroutine=create_action_item,
            name="create_action_item",
            description="Create a new action item. Only use when the user explicitly asks to add a task.",
            args_schema=CreateActionItemArgs,
        ),
        StructuredTool.from_function(
            coroutine=draft_followup_email,
            name="draft_followup_email",
            description="Create a follow-up email draft for a meeting (recap, decisions, action items).",
            args_schema=MeetingCodeArgs,
        ),
    ]
