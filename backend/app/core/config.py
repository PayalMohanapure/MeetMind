"""Application settings loaded from environment variables (and backend/.env)."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REFRESH_REUSE_GRACE_SECONDS_DEFAULT = 20

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- App ---
    app_name: str = "MeetMind API"
    environment: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"
    api_v1_prefix: str = "/api/v1"

    # --- Database ---
    # Docker database from docker-compose (host port 5433). Override with DATABASE_URL in backend/.env.
    database_url: str = "postgresql+asyncpg://meetmind:YOUR_PASSWORD@127.0.0.1:5433/meetmind"
    db_echo: bool = False

    # --- Auth (JWT) ---
    jwt_secret_key: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    refresh_cookie_name: str = "meetmind_refresh"
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    login_max_fails_per_min: int = Field(default=5, ge=1)
    login_ip_max_fails_per_min: int = Field(default=30, ge=1)

    # Comma-separated list, e.g. "http://localhost:5173,https://meetmind.vercel.app"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # --- AI providers ---
    llm_provider: Literal["groq", "openai"] = "groq"
    transcribe_provider: Literal["groq", "openai"] = "groq"
    groq_api_key: str | None = None
    groq_whisper_model: str = "whisper-large-v3-turbo"
    groq_llm_model: str = "openai/gpt-oss-120b"
    groq_fallback_llm_model: str = "openai/gpt-oss-20b"
    openai_api_key: str | None = None
    openai_llm_model: str = "gpt-6-luna"
    openai_transcribe_model: str = "whisper-1"
    llm_temperature: float = 0.0
    reasoning_effort: str = "low"
    summary_reasoning_effort: str = "medium"
    refresh_reuse_grace_seconds: int = REFRESH_REUSE_GRACE_SECONDS_DEFAULT

    # "fake" is only for automated tests (no model download needed).
    embedding_provider: Literal["fastembed", "fake"] = "fastembed"
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    fastembed_cache_dir: str | None = None

    # --- Recordings & processing ---
    recordings_dir: Path = BACKEND_DIR / "storage" / "recordings"
    max_upload_mb: int = 25
    # Wait this long after a meeting ends so late uploads can arrive.
    processing_delay_seconds: int = 20

    # --- RAG ---
    chunk_size_chars: int = 1200
    chunk_overlap_chars: int = 200
    retrieval_top_k: int = 6
    summary_max_chars_per_pass: int = 20000

    # --- Agent ---
    agent_max_steps: int = 8
    agent_history_messages: int = 10
    agent_rate_limit_per_minute: int = 10

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @model_validator(mode="after")
    def _check_cookie_settings(self) -> "Settings":
        if self.cookie_samesite == "none" and not self.cookie_secure:
            raise ValueError("COOKIE_SAMESITE=none requires COOKIE_SECURE=true")
        if self.environment == "production":
            if "change-me" in self.jwt_secret_key.lower():
                raise ValueError("JWT_SECRET_KEY must be set to a strong secret in production")
            if not self.cookie_secure:
                raise ValueError("COOKIE_SECURE must be true in production")
            if any("localhost" in origin.lower() for origin in self.cors_origin_list):
                raise ValueError("CORS_ORIGINS must not include localhost in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
