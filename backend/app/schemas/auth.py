import uuid
from datetime import datetime

from pydantic import EmailStr, Field, field_validator

from app.schemas.common import CamelModel


class RegisterRequest(CamelModel):
    full_name: str = Field(min_length=2, max_length=100)
    username: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("full_name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 2:
            raise ValueError("Full name is too short")
        return value

    @field_validator("username")
    @classmethod
    def _lower_username(cls, value: str) -> str:
        return value.lower()


class LoginRequest(CamelModel):
    email_or_username: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(CamelModel):
    refresh_token: str | None = None


class UserOut(CamelModel):
    id: uuid.UUID
    full_name: str
    username: str
    email: str
    created_at: datetime


class TokenResponse(CamelModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
