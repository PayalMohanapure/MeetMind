"""Speech-to-text with Groq or OpenAI's Whisper API."""

import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from app.core.config import settings
from app.core.exceptions import ServiceUnavailableError


@dataclass
class RawSegment:
    start_s: float
    end_s: float
    text: str


class Transcriber(Protocol):
    async def transcribe(self, file_path: Path) -> list[RawSegment]: ...


class GroqTranscriber:
    def __init__(self, api_key: str, model: str):
        from groq import AsyncGroq

        self._client = AsyncGroq(api_key=api_key, max_retries=2)
        self.model = model

    async def transcribe(self, file_path: Path) -> list[RawSegment]:
        audio = await asyncio.to_thread(file_path.read_bytes)
        response = await self._client.audio.transcriptions.create(
            file=(file_path.name, audio),
            model=self.model,
            response_format="verbose_json",  # includes per-segment timestamps
            temperature=0.0,
        )
        return parse_verbose_json(_to_dict(response))


class OpenAITranscriber:
    def __init__(self, api_key: str, model: str):
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=api_key, max_retries=2)
        self.model = model

    async def transcribe(self, file_path: Path) -> list[RawSegment]:
        audio = await asyncio.to_thread(file_path.read_bytes)
        response = await self._client.audio.transcriptions.create(
            file=(file_path.name, audio),
            model=self.model,
            response_format="verbose_json",
            timestamp_granularities=["segment"],
        )
        return parse_verbose_json(_to_dict(response))


def get_transcriber() -> Transcriber:
    if settings.transcribe_provider == "openai":
        if not settings.openai_api_key:
            raise ServiceUnavailableError(
                "OPENAI_API_KEY is not configured. Add it to backend/.env to enable AI features."
            )
        return OpenAITranscriber(settings.openai_api_key, settings.openai_transcribe_model)
    if not settings.groq_api_key:
        raise ServiceUnavailableError(
            "GROQ_API_KEY is not configured. Add it to backend/.env to enable AI features."
        )
    return GroqTranscriber(settings.groq_api_key, settings.groq_whisper_model)


def _to_dict(response: Any) -> dict:
    if isinstance(response, dict):
        return response
    if hasattr(response, "to_dict"):
        return response.to_dict()
    return response.model_dump()


def parse_verbose_json(data: dict) -> list[RawSegment]:
    segments: list[RawSegment] = []
    for seg in data.get("segments") or []:
        text = str(seg.get("text", "")).strip()
        if text:
            segments.append(RawSegment(float(seg.get("start", 0.0)), float(seg.get("end", 0.0)), text))
    # Fallback: no segment list, only full text.
    if not segments and str(data.get("text", "")).strip():
        segments.append(RawSegment(0.0, float(data.get("duration") or 0.0), data["text"].strip()))
    return segments
