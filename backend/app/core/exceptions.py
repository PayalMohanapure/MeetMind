"""Domain errors.

Services raise these instead of FastAPI's HTTPException, so business logic
does not depend on the web layer. `app.main` converts them to JSON responses.
"""


class AppError(Exception):
    status_code: int = 400
    default_detail: str = "Request could not be processed"

    def __init__(self, detail: str | None = None, headers: dict[str, str] | None = None):
        self.detail = detail or self.default_detail
        self.headers = headers
        super().__init__(self.detail)


class BadRequestError(AppError):
    status_code = 400
    default_detail = "Bad request"


class AuthenticationError(AppError):
    status_code = 401
    default_detail = "Could not validate credentials"

    def __init__(self, detail: str | None = None):
        super().__init__(detail, headers={"WWW-Authenticate": "Bearer"})


class ForbiddenError(AppError):
    status_code = 403
    default_detail = "You do not have permission to do this"


class NotFoundError(AppError):
    status_code = 404
    default_detail = "Resource not found"


class ConflictError(AppError):
    status_code = 409
    default_detail = "Resource conflict"


class PayloadTooLargeError(AppError):
    status_code = 413
    default_detail = "File is too large"


class RateLimitError(AppError):
    status_code = 429
    default_detail = "Too many requests, please slow down"


class ServiceUnavailableError(AppError):
    status_code = 503
    default_detail = "Service temporarily unavailable"
