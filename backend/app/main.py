"""Application entry point.

Run locally:   uvicorn app.main:app --reload
`app` is the Socket.IO ASGI app wrapping FastAPI, so one server handles
REST (/api/v1/...), docs (/docs) and real-time signaling (/socket.io/).
"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import AppError
from app.core.logging import configure_logging
from app.db.session import engine
from app.realtime.socket_server import sio

configure_logging(settings.log_level)
logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings.recordings_dir.mkdir(parents=True, exist_ok=True)
    logger.info("%s starting (%s)", settings.app_name, settings.environment)
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    application = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description=(
            "Backend for MeetMind: video meetings with JWT auth, WebRTC signaling, "
            "Whisper transcription, RAG search over pgvector and a tool-calling AI agent."
        ),
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=exc.headers,
        )

    @application.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    @application.get("/health", tags=["Health"])
    async def health() -> dict[str, str]:
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            database = "ok"
        except Exception:  # noqa: BLE001
            database = "unavailable"
        return {"status": "ok", "database": database}

    application.include_router(api_router, prefix=settings.api_v1_prefix)
    return application


fastapi_app = create_app()

# Socket.IO handles /socket.io/*; everything else goes to FastAPI.
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path="socket.io")
