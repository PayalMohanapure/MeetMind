"""Text embeddings.

FastEmbedEmbedder runs BAAI/bge-small-en-v1.5 locally on CPU (ONNX, no GPU,
no API key). The model (~130 MB) downloads on first use and is then cached.

FakeEmbedder is a tiny deterministic embedder used only in automated tests.
"""

import asyncio
import hashlib
import logging
import math
import re
import threading
from typing import Protocol

from app.models import EMBEDDING_DIM

logger = logging.getLogger(__name__)


class Embedder(Protocol):
    async def embed_documents(self, texts: list[str]) -> list[list[float]]: ...
    async def embed_query(self, text: str) -> list[float]: ...


class FastEmbedEmbedder:
    def __init__(self, model_name: str, cache_dir: str | None = None):
        self.model_name = model_name
        self.cache_dir = cache_dir
        self._model = None
        self._lock = threading.Lock()

    def _get_model(self):
        # Loaded lazily (first request), once per process.
        if self._model is None:
            with self._lock:
                if self._model is None:
                    from fastembed import TextEmbedding

                    logger.info("Loading embedding model %s", self.model_name)
                    self._model = TextEmbedding(model_name=self.model_name, cache_dir=self.cache_dir)
        return self._model

    def _embed_passages(self, texts: list[str]) -> list[list[float]]:
        vectors = [v.tolist() for v in self._get_model().passage_embed(texts)]
        _check_dim(vectors)
        return vectors

    def _embed_query(self, text: str) -> list[float]:
        vectors = [v.tolist() for v in self._get_model().query_embed([text])]
        _check_dim(vectors)
        return vectors[0]

    # The model is CPU-bound, so it runs in a worker thread to keep the
    # event loop (and live calls) responsive.
    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        return await asyncio.to_thread(self._embed_passages, texts)

    async def embed_query(self, text: str) -> list[float]:
        return await asyncio.to_thread(self._embed_query, text)


class FakeEmbedder:
    """Hashing bag-of-words embedder: texts sharing words get similar vectors."""

    _word = re.compile(r"[a-z0-9]+")

    def _vector(self, text: str) -> list[float]:
        vec = [0.0] * EMBEDDING_DIM
        for word in self._word.findall(text.lower()):
            index = int(hashlib.md5(word.encode()).hexdigest(), 16) % EMBEDDING_DIM
            vec[index] += 1.0
        norm = math.sqrt(sum(x * x for x in vec)) or 1.0
        return [x / norm for x in vec]

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._vector(t) for t in texts]

    async def embed_query(self, text: str) -> list[float]:
        return self._vector(text)


def _check_dim(vectors: list[list[float]]) -> None:
    if vectors and len(vectors[0]) != EMBEDDING_DIM:
        raise ValueError(
            f"Embedding model returned {len(vectors[0])} dimensions, "
            f"but the database column expects {EMBEDDING_DIM}"
        )
