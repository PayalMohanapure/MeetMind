# MeetMind — Backend

FastAPI backend for MeetMind, an AI-powered video meeting platform.

- **Auth:** JWT access tokens + rotating refresh tokens (httpOnly cookie), Argon2 password hashing
- **Meetings:** create / join / end, history, in-call chat, access control
- **Real-time:** WebRTC signaling over Socket.IO (python-socketio)
- **AI pipeline:** per-speaker Whisper transcription → time-merged transcript → chunks → embeddings in **PostgreSQL + pgvector** → LLM summary and action items
- **RAG search:** user-scoped semantic search with an HNSW cosine index
- **Agent:** LangChain v1 `create_agent` (LangGraph) with 5 tools: search meetings, get summary, list/create action items, draft follow-up email
- **Quality:** ruff lint and format, Docker image

## Architecture

```
React (Vercel) ──REST + JWT──►  FastAPI  ──SQLAlchemy async (asyncpg)──►  PostgreSQL 16 + pgvector
       │                         │  api/v1/      routes (thin)
       └──Socket.IO (JWT)──────► │  services/    business logic, access control
                                 │  realtime/    signaling + chat
Browser A ◄══ WebRTC P2P ══► B   │  ai/          transcription, chunking, embeddings, retrieval, summaries
(media never hits the server)    │  agent/       tool-calling agent (tools bound to the current user)
                                 └─ Groq API (Whisper + Llama), fastembed (local CPU embeddings)
```

## Quick start (local)

Requirements: Python 3.11+ (3.12 recommended), Docker Desktop.

```bash
# 1. Database (PostgreSQL 16 + pgvector) — from the repo root
cp .env.example .env          # set POSTGRES_PASSWORD
docker compose up -d db

# 2. Python environment
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate     macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt

# 3. Settings
cp .env.example .env          # Windows: copy .env.example .env
# edit .env: the same DB password in DATABASE_URL, JWT_SECRET_KEY, GROQ_API_KEY (or OPENAI_API_KEY)

# 4. Create the tables
alembic upgrade head

# 5. Run
uvicorn app.main:app --reload
```

Open **http://localhost:8000/docs** for interactive API docs. Click **Authorize** and paste the
`accessToken` from `POST /api/v1/auth/login` to try protected endpoints.

The first AI request downloads the embedding model (~130 MB, once).

## Lint

```bash
ruff check . && ruff format --check .
```

## Deploy (summary)

- **Database:** Neon or Supabase (both support pgvector). Use the `postgresql+asyncpg://` URL form.
- **Backend:** Render → New Web Service → Docker, root directory `backend`. Set env vars from
  `.env.example`; in production set `ENVIRONMENT=production`, `COOKIE_SECURE=true`,
  `COOKIE_SAMESITE=none`, and `CORS_ORIGINS` to your Vercel URL.
- Run a **single instance**: Socket.IO rooms and the rate limiter are kept in memory.
