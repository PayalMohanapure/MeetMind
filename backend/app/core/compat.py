"""Compatibility aliases for Python versions supported by the backend."""

import sys

if sys.version_info >= (3, 11):  # noqa: UP036
    from datetime import UTC
    from enum import StrEnum
else:
    from datetime import timezone
    from enum import Enum

    UTC = timezone.utc  # noqa: UP017

    class StrEnum(str, Enum):  # noqa: UP042
        def __str__(self) -> str:
            return str(self.value)
