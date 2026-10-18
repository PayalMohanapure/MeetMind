# MeetMind

AI video meeting platform: browser video calls that turn into a speaker-labelled transcript,
written minutes (summary, decisions, action items) and a chatbot that answers questions about
your meetings with timestamped sources.

## Stack
- **Backend:** Python, FastAPI, PostgreSQL 16 + pgvector, SQLAlchemy 2 (async), Alembic, Socket.IO,
  JWT (Argon2, rotating refresh tokens), Whisper transcription, local embeddings (BAAI/bge-small-en-v1.5),
  LangChain / LangGraph tool-calling agent, OpenAI or Groq.
- **Frontend:** React 19, Vite, Tailwind CSS, React Three Fiber (Three.js), TanStack Query, WebRTC.

## How it works
1. Users sign up and start or join a meeting (WebRTC mesh, Socket.IO signalling, in-call chat).
2. Each participant's microphone is recorded in the browser and uploaded when the call ends.
3. A background pipeline transcribes the audio (Whisper), merges speakers by time, splits the transcript
   into chunks, embeds them into pgvector and asks an LLM for the minutes and action items.
4. The assistant searches only the meetings the user joined and cites the meeting and timestamp.

## Run locally
```bash
cp .env.example .env                         # set POSTGRES_PASSWORD
docker compose up -d db                      # PostgreSQL + pgvector on port 5433

cd backend
python -m venv .venv && .venv/Scripts/activate   # Windows (use bin/activate on macOS/Linux)
pip install -r requirements-dev.txt
cp .env.example .env                         # same DB password, JWT secret, AI key
alembic upgrade head
uvicorn app.main:app --reload --port 8000

cd ../frontend
cp .env.example .env
npm install
npm run dev                                  # http://localhost:5173
```

Secrets live only in the `.env` files (root, `backend/`, `frontend/`), which are never committed.

## Branches
The code was added module by module; each branch builds on the previous one and `main` has everything.

| Branch | Adds |
|---|---|
| `setup/project-foundation` | Configuration, database layer, migrations, UI foundation |
| `feature/landing-page` | Landing page with 3D hero, 404 page |
| `feature/authentication` | JWT auth, login and sign-up |
| `feature/meetings-dashboard` | Meetings API, home dashboard, app shell |
| `feature/video-calls` | WebRTC calls, Socket.IO signalling, lobby |
| `feature/recording-ai-pipeline` | Recording upload, transcription, embeddings, minutes |
| `feature/action-items` | Tasks |
| `feature/ai-chatbot` | Tool-calling assistant |
