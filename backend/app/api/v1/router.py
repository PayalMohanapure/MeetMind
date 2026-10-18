from fastapi import APIRouter

from app.api.v1 import action_items, agent, auth, meetings, recordings, transcripts

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(meetings.router)
api_router.include_router(recordings.router)
api_router.include_router(transcripts.router)
api_router.include_router(action_items.router)
api_router.include_router(agent.router)
