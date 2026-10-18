def format_timestamp(ms: int) -> str:
    """12_345 -> '00:12', 3_725_000 -> '1:02:05'."""
    total_seconds = max(0, int(ms // 1000))
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes:02d}:{seconds:02d}"
