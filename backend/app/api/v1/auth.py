from fastapi import APIRouter, Request, Response, status

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.core.exceptions import AuthenticationError, RateLimitError
from app.core.rate_limit import limiter
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, UserOut
from app.services import auth_service
from app.services.auth_service import IssuedTokens

router = APIRouter(prefix="/auth", tags=["Auth"])

# The refresh cookie is only sent to /auth endpoints, not to every API call.
REFRESH_COOKIE_PATH = f"{settings.api_v1_prefix}/auth"
LOGIN_RATE_LIMIT_WINDOW_S = 60
RATE_LIMIT_DETAIL = "Too many attempts, try again in a minute"


def _login_rate_limit_keys(request: Request, identifier: str) -> tuple[str, str]:
    client_ip = request.client.host if request.client else "unknown"
    normalized_identifier = identifier.strip().lower()
    return (
        f"login:{client_ip}:{normalized_identifier}",
        f"login-ip:{client_ip}",
    )


def _check_login_rate_limit(account_key: str, ip_key: str) -> None:
    if limiter.is_limited(
        account_key, settings.login_max_fails_per_min, LOGIN_RATE_LIMIT_WINDOW_S
    ) or limiter.is_limited(ip_key, settings.login_ip_max_fails_per_min, LOGIN_RATE_LIMIT_WINDOW_S):
        raise RateLimitError(RATE_LIMIT_DETAIL, headers={"Retry-After": "60"})


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path=REFRESH_COOKIE_PATH,
    )


def _token_response(response: Response, issued: IssuedTokens) -> TokenResponse:
    _set_refresh_cookie(response, issued.refresh_token)
    return TokenResponse(
        access_token=issued.access_token,
        refresh_token=issued.refresh_token,
        expires_in=issued.expires_in,
        user=UserOut.model_validate(issued.user),
    )


@router.post(
    "/register",
    response_model=UserOut,
    response_model_by_alias=False,
    status_code=status.HTTP_201_CREATED,
)
async def register(data: RegisterRequest, db: DbSession) -> UserOut:
    """Create a new account."""
    user = await auth_service.register_user(db, data)
    return UserOut.model_validate(user)


@router.post("/login", response_model=TokenResponse, response_model_by_alias=False)
async def login(data: LoginRequest, request: Request, response: Response, db: DbSession) -> TokenResponse:
    """Log in with email or username. Returns an access token and sets the refresh cookie."""
    account_key, ip_key = _login_rate_limit_keys(request, data.email_or_username)
    _check_login_rate_limit(account_key, ip_key)
    try:
        user = await auth_service.authenticate(db, data.email_or_username, data.password)
    except AuthenticationError as exc:
        account_hit = limiter.hit(account_key, settings.login_max_fails_per_min, LOGIN_RATE_LIMIT_WINDOW_S)
        ip_hit = limiter.hit(ip_key, settings.login_ip_max_fails_per_min, LOGIN_RATE_LIMIT_WINDOW_S)
        if not account_hit or not ip_hit:
            raise RateLimitError(RATE_LIMIT_DETAIL, headers={"Retry-After": "60"}) from exc
        raise
    issued = await auth_service.issue_tokens(db, user)
    limiter.clear(account_key)
    return _token_response(response, issued)


@router.post("/refresh", response_model=TokenResponse, response_model_by_alias=False)
async def refresh(
    request: Request,
    response: Response,
    db: DbSession,
    data: RefreshRequest | None = None,
) -> TokenResponse:
    """Rotate the refresh token supplied in the body or the httpOnly cookie."""
    raw = (data.refresh_token if data else None) or request.cookies.get(settings.refresh_cookie_name)
    issued = await auth_service.rotate_refresh_token(db, raw)
    return _token_response(response, issued)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request, response: Response, db: DbSession, data: RefreshRequest | None = None
) -> Response:
    """Revoke the refresh token (from the httpOnly cookie or the body) and clear the cookie."""
    raw = request.cookies.get(settings.refresh_cookie_name) or (data.refresh_token if data else None)
    await auth_service.revoke_refresh_token(db, raw)
    response.status_code = status.HTTP_204_NO_CONTENT
    response.delete_cookie(
        settings.refresh_cookie_name,
        path=REFRESH_COOKIE_PATH,
        secure=settings.cookie_secure,
        httponly=True,
        samesite=settings.cookie_samesite,
    )
    return response


@router.get("/me", response_model=UserOut, response_model_by_alias=False)
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
