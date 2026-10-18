"""Meeting summary + action-item extraction with an LLM (JSON output).

Short transcripts are summarized in one call. Long ones use map-reduce:
each part is turned into notes first, then the notes are summarized.
"""

import json
import logging
from datetime import date

from pydantic import BaseModel, Field, ValidationError, field_validator

from app.ai.llm import JsonLLM

logger = logging.getLogger(__name__)


class ExtractedActionItem(BaseModel):
    description: str = Field(min_length=3, max_length=1000)
    assignee_name: str | None = Field(default=None, max_length=100)
    due_date: date | None = None

    @field_validator("assignee_name", mode="before")
    @classmethod
    def _blank_to_none(cls, value):
        if isinstance(value, str) and value.strip().lower() in {"", "none", "null", "unassigned"}:
            return None
        return value

    @field_validator("due_date", mode="before")
    @classmethod
    def _only_iso_dates(cls, value):
        # The model sometimes answers "Friday" or "next week"; keep only real dates.
        if isinstance(value, str):
            try:
                return date.fromisoformat(value.strip())
            except ValueError:
                return None
        return value


class SummaryResult(BaseModel):
    summary: str = Field(min_length=1)
    key_points: list[str] = Field(default_factory=list)
    decisions: list[str] = Field(default_factory=list)
    action_items: list[ExtractedActionItem] = Field(default_factory=list)


SYSTEM_PROMPT = """You are an assistant that writes accurate meeting minutes.
Use ONLY information stated in the transcript. Never invent names, dates or tasks.
Return a JSON object with exactly these keys:
{
  "summary": "3-6 sentence overview of the meeting",
  "key_points": ["short bullet", ...],
  "decisions": ["decision that was agreed", ...],
  "action_items": [
    {"description": "what must be done", "assignee_name": "person's name or null",
     "due_date": "YYYY-MM-DD or null"}
  ]
}
Convert relative deadlines (e.g. "next Friday") to YYYY-MM-DD using the meeting date
only when the date is unambiguous; otherwise use null. Use empty lists when nothing applies."""

NOTES_PROMPT = """You are taking notes on one part of a long meeting.
Using ONLY the transcript part, return JSON: {"notes": ["concise note", ...]}.
Keep every decision, task, owner and deadline that is mentioned."""


def _user_prompt(transcript: str, participants: list[str], meeting_date: date | None) -> str:
    return (
        f"Meeting date: {meeting_date.isoformat() if meeting_date else 'unknown'}\n"
        f"Participants: {', '.join(participants) or 'unknown'}\n\n"
        f"Transcript:\n{transcript}"
    )


async def _summarize_once(llm: JsonLLM, user_prompt: str) -> SummaryResult:
    last_error: Exception | None = None
    for attempt in range(2):  # one retry if the JSON does not match the schema
        try:
            data = await llm.complete_json(SYSTEM_PROMPT, user_prompt)
            return SummaryResult.model_validate(data)
        except (ValidationError, json.JSONDecodeError) as exc:
            last_error = exc
            logger.warning("Summary JSON invalid (attempt %d): %s", attempt + 1, exc)
    raise ValueError(f"The AI returned an invalid summary twice: {last_error}")


def _split_text(text: str, max_chars: int) -> list[str]:
    parts: list[str] = []
    current: list[str] = []
    size = 0
    for line in text.splitlines():
        if current and size + len(line) + 1 > max_chars:
            parts.append("\n".join(current))
            current, size = [], 0
        current.append(line)
        size += len(line) + 1
    if current:
        parts.append("\n".join(current))
    return parts


async def summarize_transcript(
    llm: JsonLLM,
    transcript: str,
    participants: list[str],
    meeting_date: date | None,
    max_chars_per_pass: int = 20000,
) -> SummaryResult:
    if len(transcript) <= max_chars_per_pass:
        return await _summarize_once(llm, _user_prompt(transcript, participants, meeting_date))

    notes: list[str] = []
    for index, part in enumerate(_split_text(transcript, max_chars_per_pass), start=1):
        data = await llm.complete_json(NOTES_PROMPT, f"Part {index}:\n{part}")
        notes.extend(str(n) for n in data.get("notes", []) if str(n).strip())
    combined = "\n".join(f"- {n}" for n in notes)
    return await _summarize_once(
        llm, _user_prompt(f"(Notes from a long meeting)\n{combined}", participants, meeting_date)
    )
