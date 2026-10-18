"""WebRTC signaling and in-call chat over Socket.IO (python-socketio, ASGI mode).

Media (audio/video) never passes through this server: browsers connect
peer-to-peer with WebRTC. This server only relays the small signaling
messages (SDP offers/answers and ICE candidates) and chat.

Client -> server events
    join-call      (meetingCode)           join a meeting room
    signal         (toSid, message)        relay SDP/ICE to one peer
    chat-message   (text)                  send chat to the room
    leave-call     ()                      leave without disconnecting

Server -> client events
    user-joined    (sid, [allSidsInRoom])  someone joined (sent to whole room)
    participants   ([{sid, userId, fullName}])  names for each connection
    signal         (fromSid, message)      relayed signaling data
    chat-message   (text, senderName, senderSid)  chat (history uses sid=None)
    user-left      (sid)                   someone left
    meeting-ended  ({meetingCode})         host ended the meeting
    call-error     ({detail})              join failed (e.g. meeting ended)

Authentication: the client passes the JWT access token in the handshake:
    io(SOCKET_URL, { auth: { token: accessToken } })

Note: room membership is kept in memory, so run a single server process.
For several processes, use socketio.AsyncRedisManager.
"""

import logging
import uuid
from typing import Any

import socketio

from app.core.config import settings
from app.core.exceptions import AppError
from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models import User
from app.services import meeting_service

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.cors_origin_list,
    logger=False,
    engineio_logger=False,
)

# room name -> {sid: {"userId": str, "fullName": str}}
_rooms: dict[str, dict[str, dict[str, str]]] = {}


def room_name(meeting_code: str) -> str:
    return f"meeting:{meeting_code}"


def _participants_payload(room: str) -> list[dict[str, str]]:
    return [{"sid": sid, **info} for sid, info in _rooms.get(room, {}).items()]


@sio.event
async def connect(sid: str, environ: dict, auth: dict | None = None) -> None:
    token = (auth or {}).get("token")
    if not token:
        raise socketio.exceptions.ConnectionRefusedError("Authentication required")
    try:
        user_id = decode_access_token(token)
    except AppError as exc:
        raise socketio.exceptions.ConnectionRefusedError(exc.detail) from exc

    async with SessionLocal() as db:
        user = await db.get(User, user_id)
    if user is None:
        raise socketio.exceptions.ConnectionRefusedError("User not found")

    await sio.save_session(
        sid,
        {
            "user_id": str(user.id),
            "full_name": user.full_name,
            "meeting_id": None,
            "meeting_code": None,
        },
    )
    logger.info("Socket connected: %s (user %s)", sid, user.id)


@sio.on("join-call")
async def join_call(sid: str, meeting_code: Any) -> None:
    if not isinstance(meeting_code, str) or not meeting_code.strip():
        await sio.emit("call-error", {"detail": "Meeting code is required"}, to=sid)
        return

    session = await sio.get_session(sid)
    if session.get("meeting_code"):
        await _leave_room(sid, session)

    user_id = uuid.UUID(session["user_id"])
    async with SessionLocal() as db:
        try:
            meeting = await meeting_service.join_meeting(db, user_id, meeting_code)
        except AppError as exc:
            await sio.emit("call-error", {"detail": exc.detail}, to=sid)
            return
        history = await meeting_service.list_chat_messages(db, meeting.id, limit=100)

    room = room_name(meeting.meeting_code)
    await sio.enter_room(sid, room)
    _rooms.setdefault(room, {})[sid] = {"userId": session["user_id"], "fullName": session["full_name"]}
    session.update(meeting_id=str(meeting.id), meeting_code=meeting.meeting_code)
    await sio.save_session(sid, session)

    all_sids = list(_rooms[room].keys())
    await sio.emit("user-joined", (sid, all_sids), room=room)
    await sio.emit("participants", _participants_payload(room), room=room)

    # Send earlier chat messages only to the person who just joined.
    for message in history:
        await sio.emit("chat-message", (message.content, message.user.full_name, None), to=sid)


@sio.on("signal")
async def signal(sid: str, to_sid: Any, message: Any) -> None:
    """Relay WebRTC signaling data, but only between members of the same room."""
    session = await sio.get_session(sid)
    code = session.get("meeting_code")
    if not code or not isinstance(to_sid, str):
        return
    if to_sid not in _rooms.get(room_name(code), {}):
        return
    await sio.emit("signal", (sid, message), to=to_sid)


@sio.on("chat-message")
async def chat_message(sid: str, text: Any, *_ignored: Any) -> None:
    """Save and broadcast chat. The sender name always comes from the server, never the client."""
    session = await sio.get_session(sid)
    if not session.get("meeting_id") or not isinstance(text, str):
        return
    async with SessionLocal() as db:
        try:
            saved = await meeting_service.add_chat_message(
                db, uuid.UUID(session["meeting_id"]), uuid.UUID(session["user_id"]), text
            )
        except AppError as exc:
            await sio.emit("call-error", {"detail": exc.detail}, to=sid)
            return
    await sio.emit(
        "chat-message",
        (saved.content, session["full_name"], sid),
        room=room_name(session["meeting_code"]),
    )


@sio.on("leave-call")
async def leave_call(sid: str, *_args: Any) -> None:
    session = await sio.get_session(sid)
    await _leave_room(sid, session)
    session.update(meeting_id=None, meeting_code=None)
    await sio.save_session(sid, session)


@sio.event
async def disconnect(sid: str, reason: Any = None) -> None:
    try:
        session = await sio.get_session(sid)
    except KeyError:
        return
    await _leave_room(sid, session)
    logger.info("Socket disconnected: %s", sid)


async def _leave_room(sid: str, session: dict) -> None:
    code = session.get("meeting_code")
    if not code:
        return
    room = room_name(code)
    members = _rooms.get(room, {})
    members.pop(sid, None)
    if not members:
        _rooms.pop(room, None)
    await sio.leave_room(sid, room)
    await sio.emit("user-left", sid, room=room)
    if members:
        await sio.emit("participants", _participants_payload(room), room=room)

    # Mark as left only if this user has no other open tab in the room.
    if session["user_id"] not in {m["userId"] for m in members.values()}:
        async with SessionLocal() as db:
            await meeting_service.leave_meeting(
                db, uuid.UUID(session["user_id"]), uuid.UUID(session["meeting_id"])
            )


async def notify_meeting_ended(meeting_code: str) -> None:
    """Called by the REST API when the host ends a meeting."""
    await sio.emit("meeting-ended", {"meetingCode": meeting_code}, room=room_name(meeting_code))
