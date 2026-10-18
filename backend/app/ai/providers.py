"""Factories for AI providers, configured from settings.

Code elsewhere calls `providers.get_embedder()` etc. (through the module),
so tests can swap in fakes with monkeypatch.
"""

from functools import lru_cache

from app.ai.embeddings import Embedder, FakeEmbedder, FastEmbedEmbedder
from app.ai.llm import GroqJsonLLM, JsonLLM, OpenAIJsonLLM
from app.ai.transcription import get_transcriber as get_transcriber
from app.core.config import settings
from app.core.exceptions import ServiceUnavailableError


def _require_groq_key() -> str:
    if not settings.groq_api_key:
        raise ServiceUnavailableError(
            "GROQ_API_KEY is not configured. Add it to backend/.env to enable AI features."
        )
    return settings.groq_api_key


def _require_openai_key() -> str:
    if not settings.openai_api_key:
        raise ServiceUnavailableError(
            "OPENAI_API_KEY is not configured. Add it to backend/.env to enable AI features."
        )
    return settings.openai_api_key


@lru_cache
def get_embedder() -> Embedder:
    if settings.embedding_provider == "fake":
        return FakeEmbedder()
    return FastEmbedEmbedder(settings.embedding_model, settings.fastembed_cache_dir)


def get_json_llm() -> JsonLLM:
    """LLM used for meeting summaries; follows LLM_PROVIDER like the agent does."""
    if settings.llm_provider == "openai":
        return OpenAIJsonLLM(_require_openai_key(), settings.openai_llm_model, settings.llm_temperature)
    return GroqJsonLLM(_require_groq_key(), settings.groq_llm_model, settings.llm_temperature)


def get_chat_model():
    """Tool-calling chat model for the agent (LangChain interface)."""
    if settings.llm_provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=settings.openai_llm_model,
            api_key=_require_openai_key(),
            temperature=settings.llm_temperature,
        )

    from langchain_groq import ChatGroq

    return ChatGroq(
        model=settings.groq_llm_model,
        api_key=_require_groq_key(),
        temperature=settings.llm_temperature,
        max_retries=2,
        model_kwargs={
            "parallel_tool_calls": False,
            "reasoning_effort": settings.reasoning_effort,
            "include_reasoning": False,
        },
    )
