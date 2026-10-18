"""LLM call that must return a JSON object (used for summaries)."""

import json
from typing import Protocol


class JsonLLM(Protocol):
    model_name: str

    async def complete_json(self, system_prompt: str, user_prompt: str) -> dict: ...


class GroqJsonLLM:
    def __init__(self, api_key: str, model: str, temperature: float = 0.0):
        from groq import AsyncGroq

        self._client = AsyncGroq(api_key=api_key, max_retries=2)
        self.model_name = model
        self.temperature = temperature

    async def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        response = await self._client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=self.temperature,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or "{}"
        return json.loads(content)


class OpenAIJsonLLM:
    """Same interface as GroqJsonLLM, using the OpenAI API (LLM_PROVIDER=openai)."""

    def __init__(self, api_key: str, model: str, temperature: float = 0.0):
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=api_key, max_retries=2)
        self.model_name = model
        self.temperature = temperature

    async def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        response = await self._client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=self.temperature,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or "{}"
        return json.loads(content)
