# MeetMind frontend ("Aurora Glass", V4)

React 19.3 · Vite 8 · Tailwind CSS 4.3 · React Three Fiber 9 + drei 10 · TanStack Query 5 · Socket.IO · WebRTC · SSE

The whole UI for MeetMind: landing page with a live 3D "voice orb", auth, Home, Meetings, Lobby, the meeting room,
the after-call page, the meeting record, the Assistant, Tasks, Settings and the 404 page.

## Quick start

```bash
cd frontend
npm install
cp .env.example .env        # points at your FastAPI backend on http://localhost:8000/api/v1
npm run dev                 # http://localhost:5173
```

No backend yet? Set `VITE_USE_MOCK=true` to use the in-browser demo backend (nothing is saved;
login **payal / MeetMind@123**). See `../MEETMIND_FIX_AND_RUN.md` for the full setup.

## Connect it to your FastAPI backend

1. In `.env` set `VITE_API_URL=http://localhost:8000` (and `VITE_API_PREFIX` if your routers aren't under `/api`).
2. Open **`src/api/endpoints.js`**. It is the single place that lists every route, request body, response shape,
   SSE event and Socket.IO event the UI uses. Change the paths there to match your routers.
   - Login body: set `AUTH.loginFormat` to `'form'` if you use `OAuth2PasswordRequestForm`.
   - Refresh: the client sends cookies (`credentials: 'include'`) **and**, if your login returns a `refresh_token`
     in the body, sends it back as `{ refresh_token }`. Either style works.
3. Allow the frontend origin in FastAPI CORS with `allow_credentials=True`.
4. Set the feature flags in `.env` (`VITE_FEATURE_*`) to match what the backend supports; disabled features are hidden.

The in-browser mock backend (`src/mock/`) implements exactly the same contract, so it doubles as living
documentation of the expected JSON.

| Area | Expected backend piece |
|---|---|
| Auth | `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/me`, `/auth/logout`, `/auth/demo` |
| Meetings | `/meetings` CRUD, `/join` (with `consent`), `/leave`, `/end`, `/status`, `/transcript`, `/summary` |
| Recording | `POST /recordings/{code}/upload` multipart, 30 s audio chunks (retried from IndexedDB) |
| Assistant | `POST /agent/chat/stream` (SSE: `meta`, `tool`, `token`, `sources`, `confirm`, `done`), confirm/cancel actions |
| Realtime | Socket.IO events `join_room`, `room_state`, `peer_joined`, `peer_left`, `signal`, `media_state`, `chat_message`, `caption`, `hand`, `reaction`, `meeting_ended` |

WebRTC is a mesh (≤ 6 people): the newcomer sends offers to everyone in `room_state`; others answer.
ICE servers come from `GET /rtc/ice-servers` (falls back to Google STUN).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm run preview` | Production build / serve it on :4173 |
| `npm run lint` | ESLint (0 errors, 0 warnings) |

## Structure

```
src/
  api/          endpoints.js (the contract) + one module per area
  lib/          api client, session, SSE, socket, formatting, voice colours, invite links, upload queue
  mock/         in-browser demo backend + simulated meeting room
  hooks/        queries, media devices, speaking level, WebRTC room, recorder, processing status
  components/
    three/      OrbScene (R3F), Stage (lazy loader + poster fallback + performance tiers)
    brand/ ui/ layout/ landing/ auth/ home/ meeting/ record/ ai/ common/
  pages/        one file per route
  styles/       tokens.css (Daylight · Night · Dusk) + globals.css (Tailwind v4 @theme)
```

## Design notes

- **Colour jobs:** cobalt = action, sun = speaking / highlight, iris = anything AI-written, coral = recording /
  destructive / errors, green = done. Six voice colours identify people everywhere (tiles, avatars, transcript, voiceprint).
- **Type:** Bricolage Grotesque (display), Instrument Sans (interface), Newsreader (everything that was said or written by AI).
- **3D** only where it helps the story: landing, login/register, Home start card, Assistant empty state, the after-call
  page and 404. Never in the meeting room. It loads after the page is interactive, pauses off-screen, and falls back to
  a CSS orb on weak devices, `prefers-reduced-motion` or Save-Data. Add `?no3d` to any URL to force the fallback.
- Accessibility: keyboard everywhere, visible focus, `aria-live` for streaming answers, captions and banners,
  AA contrast (axe: 0 serious issues on public pages).
