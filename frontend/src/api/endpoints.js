/**
 * BACKEND CONTRACT — matches the MeetMind FastAPI backend exactly (backend/app/api/v1/*).
 * Paths are relative to VITE_API_URL + VITE_API_PREFIX (default http://localhost:8000/api/v1).
 * Responses arrive in camelCase (or snake_case for /auth); src/api/normalize.js maps them for the UI.
 */
import { USE_MOCK } from '@/config/env';

export const AUTH = {
  loginFormat: 'json',                 // body: { email_or_username, password }
  login: '/auth/login',                // → { access_token, refresh_token, expires_in, user }
  register: '/auth/register',          // { full_name, username, email, password } → user (201)
  refresh: '/auth/refresh',            // { refresh_token } or httpOnly cookie → tokens
  logout: '/auth/logout',              // 204, revokes the cookie's token
  me: '/auth/me',                      // → user
  demo: USE_MOCK ? '/auth/demo' : null, // demo mode only; the backend has no demo login
  updateMe: null,
  changePassword: null,
};

export const MEETINGS = {
  list: '/meetings',                                         // GET ?limit=&offset= → { items, total }
  create: '/meetings',                                       // POST { title, recording_enabled } → detail
  get: (code) => `/meetings/${code}`,                        // GET → detail (404 unless participant)
  join: (code) => `/meetings/${code}/join`,                  // POST → detail (first join starts it)
  leave: (code) => `/meetings/${code}/leave`,                // POST 204
  end: (code) => `/meetings/${code}/end`,                    // POST (host) → starts AI pipeline
  status: (code) => `/meetings/${code}/processing-status`,   // GET → { processingStatus, processingError, recordings* }
  reprocess: (code) => `/meetings/${code}/process`,          // POST (host)
  transcript: (code) => `/meetings/${code}/transcript`,      // GET → { lines: [...] }
  summary: (code) => `/meetings/${code}/summary`,            // GET → { summary, keyPoints, decisions, modelName }
  chat: (code) => `/meetings/${code}/chat`,                  // GET → chat history
};

export const RECORDINGS = {
  upload: (code) => `/meetings/${code}/recordings`,          // POST multipart: file, offsetMs
};

export const ACTION_ITEMS = {
  list: '/action-items',                       // GET ?status=open|done&meetingCode=
  create: '/action-items',                     // POST { description, due_date?, meeting_code?, assignee_name? }
  update: (id) => `/action-items/${id}`,       // PATCH { description?, status?, due_date? }
  remove: (id) => `/action-items/${id}`,       // DELETE
};

export const AGENT = {
  conversations: '/agent/conversations',
  conversation: (id) => `/agent/conversations/${id}`,
  chat: '/agent/chat',          // POST { message, conversation_id? } → { conversationId, reply, sources, toolsUsed }
  stream: null,                 // backend has no streaming endpoint; /agent/chat is used
  search: '/search',            // POST { query, meeting_code?, top_k? } (semantic search)
};

export const RTC = { iceServers: null }; // backend has none; public STUN is used
export const HEALTH = '/health';        // served at the server root, not under /api/v1

/**
 * Socket.IO (app/realtime/socket_server.py). Connect with auth: { token }.
 *  emit  join-call    (meetingCode)
 *  emit  signal       (toSid, message)       message is relayed as-is to one peer
 *  emit  chat-message (text)
 *  emit  leave-call   ()
 *  on    user-joined  (sid, allSids)
 *  on    participants ([{ sid, userId, fullName }])
 *  on    signal       (fromSid, message)
 *  on    chat-message (text, senderName, senderSid)   senderSid null = history
 *  on    user-left    (sid)
 *  on    meeting-ended ({ meetingCode })
 *  on    call-error   ({ detail })
 * Signal messages used by the UI: {type:'offer'|'answer', sdp} {type:'ice', candidate}
 *   {type:'state', mic, cam, screen, hand} {type:'reaction', emoji}
 */
