"""Password hashing and JWT helpers."""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.core.compat import UTC
from app.core.config import settings
from app.core.exceptions import AuthenticationError

# Argon2 (recommended by current FastAPI docs).
_password_hash = PasswordHash.recommended()

# Used to keep login timing similar when the user does not exist.
_DUMMY_HASH = _password_hash.hash("dummy-password-for-timing")


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if password_hash is None:
        _password_hash.verify(password, _DUMMY_HASH)
        return False
    return _password_hash.verify(password, password_hash)


def create_access_token(user_id: uuid.UUID) -> tuple[str, int]:
    """Return (token, expires_in_seconds)."""
    now = datetime.now(UTC)
    expires_in = settings.access_token_expire_minutes * 60
    payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
        "jti": uuid.uuid4().hex,
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, expires_in


def decode_access_token(token: str) -> uuid.UUID:
    """Validate an access token and return the user id it belongs to."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "exp", "type"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationError("Access token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthenticationError("Invalid access token") from exc

    if payload.get("type") != "access":
        raise AuthenticationError("Invalid token type")
    try:
        return uuid.UUID(payload["sub"])
    except ValueError as exc:
        raise AuthenticationError("Invalid token subject") from exc


def generate_refresh_token() -> str:
    """Random opaque refresh token. Only its hash is stored in the database."""
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
