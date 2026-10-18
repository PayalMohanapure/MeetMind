"""Small in-memory sliding-window rate limiter.

Good enough for a single server process. With several workers or servers,
replace it with a Redis-based limiter.
"""

import time
from collections import defaultdict, deque
from threading import Lock

from app.core.exceptions import RateLimitError


class SlidingWindowRateLimiter:
    def __init__(self, max_calls: int | None = None, window_seconds: float = 60.0):
        self.max_calls = max_calls
        self.window_seconds = window_seconds
        self._calls: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def _prune(self, calls: deque[float], now: float, window_s: float) -> None:
        while calls and now - calls[0] >= window_s:
            calls.popleft()

    def is_limited(self, key: str, limit: int, window_s: float) -> bool:
        now = time.monotonic()
        with self._lock:
            calls = self._calls[key]
            self._prune(calls, now, window_s)
            if not calls:
                self._calls.pop(key, None)
            return len(calls) >= limit

    def hit(self, key: str, limit: int, window_s: float) -> bool:
        now = time.monotonic()
        with self._lock:
            calls = self._calls[key]
            self._prune(calls, now, window_s)
            if len(calls) >= limit:
                return False
            calls.append(now)
            return True

    def check(self, key: str) -> None:
        if self.max_calls is None:
            raise RuntimeError("A default call limit is required to use check()")
        if not self.hit(key, self.max_calls, self.window_seconds):
            raise RateLimitError(
                f"Rate limit reached: max {self.max_calls} requests per {int(self.window_seconds)} seconds"
            )

    def clear(self, key: str | None = None) -> None:
        with self._lock:
            if key is None:
                self._calls.clear()
            else:
                self._calls.pop(key, None)

    def reset(self) -> None:
        self.clear()


limiter = SlidingWindowRateLimiter()
