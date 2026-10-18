FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    FASTEMBED_CACHE_DIR=/app/.cache/fastembed

WORKDIR /app

RUN useradd --create-home --uid 1000 appuser

COPY requirements.txt .
RUN pip install -r requirements.txt

# Download the embedding model at build time so the first request is fast.
ARG PRELOAD_EMBEDDING_MODEL=true
RUN if [ "$PRELOAD_EMBEDDING_MODEL" = "true" ]; then \
      python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5', cache_dir='/app/.cache/fastembed')"; \
    fi

COPY . .
RUN mkdir -p storage/recordings && chown -R appuser:appuser /app

USER appuser
EXPOSE 8000

# Apply migrations, then start. Render/Railway set $PORT.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers"]
