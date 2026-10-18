import logging
import sys


def configure_logging(level: str = "INFO") -> None:
    """Simple, consistent log format for the whole app."""
    logging.basicConfig(
        level=level.upper(),
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        stream=sys.stdout,
        force=True,
    )
    # Keep noisy libraries quiet.
    for noisy in ("httpx", "httpcore", "engineio.server", "socketio.server"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
