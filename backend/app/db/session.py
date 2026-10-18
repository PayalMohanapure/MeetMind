"""Async database engine and session factory (SQLAlchemy 2.0 + asyncpg)."""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings

_engine_kwargs: dict = {"echo": settings.db_echo, "pool_pre_ping": True}
if settings.environment == "test":
    # Tests run on several event loops; pooled asyncpg connections are loop-bound.
    _engine_kwargs = {"echo": settings.db_echo, "poolclass": NullPool}

engine = create_async_engine(settings.database_url, **_engine_kwargs)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: one session per request."""
    async with SessionLocal() as session:
        yield session
