"""Split a meeting transcript into overlapping chunks for embedding.

Each line looks like "[04:12] Payal: we should ship on Friday". Chunks never
cut a line in half (unless one line alone is longer than a chunk), and each
new chunk repeats the last few lines of the previous one (overlap), so an
idea that spans a chunk boundary can still be found.
"""

from dataclasses import dataclass, field

from app.ai.timefmt import format_timestamp


@dataclass
class TranscriptLineIn:
    speaker_name: str
    start_ms: int
    end_ms: int
    text: str

    def render(self) -> str:
        return f"[{format_timestamp(self.start_ms)}] {self.speaker_name}: {self.text}"


@dataclass
class Chunk:
    content: str
    start_ms: int
    end_ms: int
    speaker_names: list[str] = field(default_factory=list)


def _split_long_line(line: TranscriptLineIn, max_chars: int) -> list[TranscriptLineIn]:
    """Split one very long line into word-boundary pieces with the same timestamps."""
    prefix_len = len(line.render()) - len(line.text)
    budget = max(50, max_chars - prefix_len)
    pieces: list[str] = []
    current = ""
    for word in line.text.split():
        candidate = f"{current} {word}".strip()
        if len(candidate) > budget and current:
            pieces.append(current)
            current = word
        else:
            current = candidate
    if current:
        pieces.append(current)
    return [TranscriptLineIn(line.speaker_name, line.start_ms, line.end_ms, p) for p in pieces]


def _make_chunk(lines: list[TranscriptLineIn]) -> Chunk:
    speakers: list[str] = []
    for line in lines:
        if line.speaker_name not in speakers:
            speakers.append(line.speaker_name)
    return Chunk(
        content="\n".join(line.render() for line in lines),
        start_ms=lines[0].start_ms,
        end_ms=max(line.end_ms for line in lines),
        speaker_names=speakers,
    )


def chunk_transcript(
    lines: list[TranscriptLineIn], max_chars: int = 1200, overlap_chars: int = 200
) -> list[Chunk]:
    if max_chars <= overlap_chars:
        raise ValueError("max_chars must be larger than overlap_chars")

    expanded: list[TranscriptLineIn] = []
    for line in lines:
        if not line.text.strip():
            continue
        if len(line.render()) > max_chars:
            expanded.extend(_split_long_line(line, max_chars))
        else:
            expanded.append(line)

    chunks: list[Chunk] = []
    current: list[TranscriptLineIn] = []
    current_len = 0
    new_lines_in_current = 0

    for line in expanded:
        line_len = len(line.render()) + 1  # +1 for the newline
        if current and current_len + line_len > max_chars and new_lines_in_current > 0:
            chunks.append(_make_chunk(current))
            # Carry the tail of the previous chunk forward as overlap.
            overlap: list[TranscriptLineIn] = []
            overlap_len = 0
            for prev in reversed(current):
                prev_len = len(prev.render()) + 1
                if overlap_len + prev_len > overlap_chars:
                    break
                overlap.insert(0, prev)
                overlap_len += prev_len
            current, current_len, new_lines_in_current = overlap, overlap_len, 0
        current.append(line)
        current_len += line_len
        new_lines_in_current += 1

    if current and new_lines_in_current > 0:
        chunks.append(_make_chunk(current))
    return chunks
