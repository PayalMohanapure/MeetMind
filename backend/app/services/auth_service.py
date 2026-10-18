"""Registration, login and refresh-token rotation."""

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.compat import UTC
from app.core.config import settings
from app.core.exceptions import AuthenticationError, ConflictError
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models import RefreshToken, User
from app.schemas.auth import RegisterRequest

logger = logging.getLogger(__name__)


@dataclass
class IssuedTokens:
    user: User
    access_token: str
    expires_in: int
    refresh_token: str  # raw value, sent to the browser as an httpOnly cookie


async def register_user(db: AsyncSession, data: RegisterRequest) -> User:
    email = data.email.lower()
    existing = await db.execute(
        select(User.email, User.username).where(or_(User.email == email, User.username == data.username))
    )
    for row in existing:
        if row.email == email:
            raise ConflictError("An account with this email already exists")
        raise ConflictError("This username is already taken")

    user = User(
        full_name=data.full_name,
        username=data.username,
        email=email,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info("Registered user %s", user.id)
    return user


async def authenticate(db: AsyncSession, email_or_username: str, password: str) -> User:
    identifier = email_or_username.strip().lower()
    user = await db.scalar(select(User).where(or_(User.email == identifier, User.username == identifier)))
    # verify_password runs even when the user does not exist, so response time
    # does not reveal which emails are registered.
    if not verify_password(password, user.password_hash if user else None) or user is None:
        raise AuthenticationError("Incorrect email/username or password")
    return user


async def issue_tokens(db: AsyncSession, user: User) -> IssuedTokens:
    access_token, expires_in = create_access_token(user.id)
    raw_refresh = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            family_id=uuid.uuid4(),
            token_hash=hash_token(raw_refresh),
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    await db.commit()
    return IssuedTokens(user, access_token, expires_in, raw_refresh)


async def rotate_refresh_token(db: AsyncSession, raw_token: str | None) -> IssuedTokens:
    """Exchange a valid refresh token for new tokens; the old one is revoked."""
    if not raw_token:
        raise AuthenticationError("Refresh token missing")

    token_hash = hash_token(raw_token)
    stored = await db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash).with_for_update()
    )
    if stored is None:
        raise AuthenticationError("Invalid refresh token")

    now = datetime.now(UTC)
    user = await db.get(User, stored.user_id)
    if user is None:
        raise AuthenticationError("User no longer exists")
    if stored.expires_at <= now:
        raise AuthenticationError("Refresh token has expired; please log in again")

    if stored.revoked_at is not None:
        grace_deadline = stored.revoked_at + timedelta(seconds=settings.refresh_reuse_grace_seconds)
        if now <= grace_deadline and stored.replaced_by_id is not None:
            return await issue_tokens_for_family(db, user, stored.family_id)

        await _revoke_family(db, stored.family_id)
        logger.warning("Refresh token reuse detected for user %s family %s", stored.user_id, stored.family_id)
        raise AuthenticationError("Refresh token has already been used; please log in again")

    stored.revoked_at = now
    stored.last_used_at = now
    return await issue_tokens_for_family(db, user, stored.family_id, replaces=stored)


async def issue_tokens_for_family(
    db: AsyncSession, user: User, family_id: uuid.UUID, replaces: RefreshToken | None = None
) -> IssuedTokens:
    access_token, expires_in = create_access_token(user.id)
    raw_refresh = generate_refresh_token()
    issued_row = RefreshToken(
        user_id=user.id,
        family_id=family_id,
        token_hash=hash_token(raw_refresh),
        expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
        last_used_at=datetime.now(UTC),
    )
    db.add(issued_row)
    await db.flush()
    if replaces is not None:
        replaces.replaced_by_id = issued_row.id
    await db.commit()
    return IssuedTokens(user, access_token, expires_in, raw_refresh)


async def revoke_refresh_token(db: AsyncSession, raw_token: str | None) -> None:
    if not raw_token:
        return
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == hash_token(raw_token), RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
    await db.commit()


async def _revoke_family(db: AsyncSession, family_id: uuid.UUID) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC), last_used_at=datetime.now(UTC))
    )
    await db.commit()


async def _revoke_all_for_user(db: AsyncSession, user_id) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC), last_used_at=datetime.now(UTC))
    )
    await db.commit()
