/**
 * In-browser demo backend. Implements every route in src/api/endpoints.js with the same
 * request/response shapes the real FastAPI server is expected to use. Data persists in
 * localStorage so the demo survives reloads. Enabled automatically when VITE_API_URL is empty.
 */
import { ApiError } from '@/lib/errors';
import { sleep } from '@/lib/utils';
import { PEOPLE, seedMeetings, seedTranscripts, seedSummaries, seedActionItems, GENERIC_LINES } from './data';

const DB_KEY = 'mm-mock-db-v2';
const LATENCY = import.meta.env.MODE === 'test' ? 0 : 160;

function freshDb() {
  return {
    users: {
      'u-payal': { id: 'u-payal', username: 'payal', email: 'payal@example.com', full_name: 'Payal Mohanapure', password: 'MeetMind@123', is_demo: false },
      'u-demo': { id: 'u-demo', username: 'demo', email: 'demo@meetmind.app', full_name: 'Demo User', password: 'demo-demo-demo', is_demo: true },
    },
    workspaces: {}, // userId -> { meetings, transcripts, summaries, items, conversations, chats }
  };
}
let db = null;
function load() {
  if (db) return db;
  try { db = JSON.parse(localStorage.getItem(DB_KEY)) || freshDb(); } catch { db = freshDb(); }
  return db;
}
function save() { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch { /* quota */ } }

function ws(userId) {
  load();
  if (!db.workspaces[userId]) {
    db.workspaces[userId] = {
      meetings: seedMeetings(userId),
      transcripts: seedTranscripts(),
      summaries: seedSummaries(),
      items: seedActionItems(userId),
      conversations: [],
      chats: {},
    };
    save();
  }
  return db.workspaces[userId];
}

const publicUser = (u) => ({ id: u.id, username: u.username, email: u.email, full_name: u.full_name, is_demo: !!u.is_demo });
const tokensFor = (u) => ({ access_token: `mock-at.${u.id}.${Date.now().toString(36)}`, refresh_token: `mock-rt.${u.id}`, token_type: 'bearer', user: publicUser(u) });
const userFromToken = (token, kind = 'at') => {
  if (!token) return null;
  const m = String(token).match(new RegExp(`^mock-${kind}\\.([^.]+)`));
  return m ? load().users[m[1]] || null : null;
};

function decorate(m, user) {
  const participants = (m.participants || []).map((p) => (p.user_id === user.id ? { ...p, full_name: user.full_name } : p));
  const status = processingNow(m);
  return { ...m, participants, processing_status: status.processing_status, is_host: m.host_id === user.id };
}

const STEPS = ['waiting_uploads', 'transcribing', 'embedding', 'summarizing'];
function processingNow(m) {
  if (!m.processing_started_at || m.processing_status === 'ready' || m.processing_status === 'failed') return { processing_status: m.processing_status };
  const el = (Date.now() - m.processing_started_at) / 1000;
  const i = Math.floor(el / 3.5);
  if (i >= STEPS.length) return { processing_status: 'ready' };
  return { processing_status: STEPS[i] };
}

function finalizeIfReady(w, m, user) {
  if (processingNow(m).processing_status === 'ready' && m.processing_status !== 'ready') {
    m.processing_status = 'ready';
    if (!w.transcripts[m.code]) {
      const speakers = [{ id: user.id, name: user.full_name }, { id: PEOPLE.asha.id, name: PEOPLE.asha.full_name }, { id: PEOPLE.rahul.id, name: PEOPLE.rahul.full_name }];
      const chat = (w.chats[m.code] || []).filter((c) => c.user_id === user.id).map((c) => c.text);
      const lines = [...chat, ...GENERIC_LINES];
      const span = Math.max(m.duration_seconds || 300, 120);
      w.transcripts[m.code] = lines.map((text, k) => {
        const s = speakers[k % speakers.length];
        const start = Math.round((k / lines.length) * span);
        return { start, end: start + 12, speaker_id: s.id, speaker_name: s.name, text };
      });
      w.summaries[m.code] = {
        summary: `${m.title} covered team updates and agreed a Thursday release with a short demo.`,
        decisions: [{ text: 'Ship the release on Thursday', start: w.transcripts[m.code][4]?.start || 0 }],
        open_questions: [],
        chapters: [{ title: 'Updates', start: 0 }, { title: 'Release', start: Math.round(span * 0.4) }, { title: 'Wrap-up', start: Math.round(span * 0.8) }],
      };
      w.items.unshift({ id: `ai-${Date.now()}`, title: 'Write up the notes for the support team', status: 'open', due_date: null, assignee_id: user.id, assignee_name: 'You', meeting_code: m.code, meeting_title: m.title, source: 'ai', heard_at: w.transcripts[m.code][5]?.start || 0 });
    }
    save();
  }
}

const code = () => {
  const a = 'abcdefghijkmnopqrstuvwxyz';
  const p = (n) => Array.from({ length: n }, () => a[Math.floor(Math.random() * a.length)]).join('');
  return `${p(3)}-${p(4)}-${p(3)}`;
};

function requireUser(token) {
  const u = userFromToken(token);
  if (!u) throw new ApiError(401, 'Your session has expired. Log in again.');
  return u;
}

function validateRegister(b) {
  const errs = [];
  if (!b.full_name || b.full_name.trim().length < 2) errs.push({ loc: ['body', 'full_name'], msg: 'Enter your full name.' });
  if (!/^[A-Za-z0-9_]{3,50}$/.test(b.username || '')) errs.push({ loc: ['body', 'username'], msg: 'Username must be 3–50 letters, numbers or underscores.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email || '')) errs.push({ loc: ['body', 'email'], msg: 'Enter a valid email address.' });
  if (!b.password || b.password.length < 8) errs.push({ loc: ['body', 'password'], msg: 'Password must be at least 8 characters.' });
  return errs;
}

const routes = [];
const on = (method, pattern, fn) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), fn });

// ── Health ──
on('GET', '/health', () => ({ status: 'ok' }));

// ── Auth ──
on('POST', '/auth/login', ({ body, form }) => {
  const b = body || form || {};
  const id = String(b.email_or_username || b.username || '').trim().toLowerCase();
  const u = Object.values(load().users).find((x) => x.username.toLowerCase() === id || x.email.toLowerCase() === id);
  if (!u || u.password !== b.password) throw new ApiError(401, 'Wrong email, username or password.');
  return tokensFor(u);
});
on('POST', '/auth/register', ({ body }) => {
  const errs = validateRegister(body || {});
  if (errs.length) throw new ApiError(422, errs);
  const users = load().users;
  if (Object.values(users).some((x) => x.username.toLowerCase() === body.username.toLowerCase())) throw new ApiError(409, 'That username is taken. Try another one.');
  if (Object.values(users).some((x) => x.email.toLowerCase() === body.email.toLowerCase())) throw new ApiError(409, 'An account with this email already exists. Log in instead.');
  const u = { id: `u-${Date.now().toString(36)}`, username: body.username, email: body.email, full_name: body.full_name.trim(), password: body.password, is_demo: false, is_new: true };
  users[u.id] = u; save();
  return publicUser(u);
});
on('POST', '/auth/demo', () => tokensFor(load().users['u-demo']));
on('POST', '/auth/refresh', ({ body }) => {
  const u = userFromToken(body?.refresh_token, 'rt');
  if (!u) throw new ApiError(401, 'No session.');
  return tokensFor(u);
});
on('POST', '/auth/logout', () => null);
on('GET', '/auth/me', ({ token }) => { const u = requireUser(token); return { ...publicUser(u), is_new: !!u.is_new }; });
on('PATCH', '/auth/me', ({ token, body }) => {
  const u = requireUser(token);
  if (body.full_name !== undefined) { if (body.full_name.trim().length < 2) throw new ApiError(422, 'Enter your full name.'); u.full_name = body.full_name.trim(); }
  if (body.email !== undefined) u.email = body.email;
  save(); return publicUser(u);
});
on('POST', '/auth/change-password', ({ token, body }) => {
  const u = requireUser(token);
  if (u.password !== body.current_password) throw new ApiError(400, 'Your current password is wrong.');
  if ((body.new_password || '').length < 8) throw new ApiError(422, 'Password must be at least 8 characters.');
  u.password = body.new_password; save(); return null;
});

// ── Meetings ──
on('GET', '/meetings', ({ token, query = {} }) => {
  const u = requireUser(token); const w = ws(u.id);
  w.meetings.forEach((m) => finalizeIfReady(w, m, u));
  let list = w.meetings.map((m) => decorate(m, u));
  if (query.status && query.status !== 'all') list = list.filter((m) => m.status === query.status);
  if (query.processing) list = list.filter((m) => m.processing_status === query.processing);
  if (query.q) { const q = query.q.toLowerCase(); list = list.filter((m) => m.title.toLowerCase().includes(q) || m.participants.some((p) => p.full_name?.toLowerCase().includes(q))); }
  return list.sort((a, b) => new Date(b.started_at || b.scheduled_at || b.created_at) - new Date(a.started_at || a.scheduled_at || a.created_at));
});
on('POST', '/meetings', ({ token, body }) => {
  const u = requireUser(token); const w = ws(u.id);
  const scheduled = !!body.scheduled_at;
  const m = { code: code(), title: (body.title || '').trim() || 'Quick meeting', status: scheduled ? 'scheduled' : 'live', record: body.recording_enabled ?? body.record !== false, host_id: u.id, created_at: new Date().toISOString(), scheduled_at: body.scheduled_at || null, started_at: scheduled ? null : new Date().toISOString(), ended_at: null, duration_seconds: 0, processing_status: 'none', participants: [{ user_id: u.id, full_name: u.full_name }] };
  w.meetings.unshift(m); save();
  return decorate(m, u);
});
const findMeeting = (u, c) => {
  const w = ws(u.id);
  let m = w.meetings.find((x) => x.code === c);
  if (!m && /^[a-z0-9]{3,4}-[a-z0-9]{3,4}-[a-z0-9]{3,4}$/.test(c)) {
    // An invite link to a meeting that someone else hosts: create a live room the user can join.
    m = { code: c, title: 'Team call', status: 'live', record: true, host_id: PEOPLE.asha.id, created_at: new Date().toISOString(), started_at: new Date().toISOString(), ended_at: null, duration_seconds: 0, processing_status: 'none', participants: [{ user_id: PEOPLE.asha.id, full_name: PEOPLE.asha.full_name }] };
    w.meetings.unshift(m); save();
  }
  if (!m) throw new ApiError(404, "We couldn't find a meeting with that code. Check the link and try again.");
  return { w, m };
};
on('GET', '/meetings/:code', ({ token, params }) => { const u = requireUser(token); const { w, m } = findMeeting(u, params.code); finalizeIfReady(w, m, u); return decorate(m, u); });
on('POST', '/meetings/:code/join', ({ token, params }) => {
  const u = requireUser(token); const { m } = findMeeting(u, params.code);
  if (m.status === 'ended') throw new ApiError(410, 'This meeting has ended.');
  if (m.status === 'scheduled') { m.status = 'live'; m.started_at = new Date().toISOString(); }
  if (!m.participants.some((p) => p.user_id === u.id)) m.participants.push({ user_id: u.id, full_name: u.full_name });
  save(); return decorate(m, u);
});
const endIt = (m) => {
  m.status = 'ended'; m.ended_at = new Date().toISOString();
  m.duration_seconds = Math.max(60, Math.round((Date.now() - new Date(m.started_at || m.created_at)) / 1000));
  if (m.record) { m.processing_status = 'waiting_uploads'; m.processing_started_at = Date.now(); } else m.processing_status = 'none';
};
on('POST', '/meetings/:code/leave', ({ token, params }) => {
  const u = requireUser(token); const { m } = findMeeting(u, params.code);
  if (m.host_id === u.id && m.status === 'live') endIt(m); // demo: the host leaving ends the call, so the after-call flow is visible
  save(); return null;
});
on('POST', '/meetings/:code/end', ({ token, params }) => {
  const u = requireUser(token); const { m } = findMeeting(u, params.code);
  if (m.host_id !== u.id) throw new ApiError(403, 'Only the host can end the meeting for everyone.');
  endIt(m); save(); return null;
});
on('GET', '/meetings/:code/processing-status', ({ token, params }) => {
  const u = requireUser(token); const { w, m } = findMeeting(u, params.code); finalizeIfReady(w, m, u);
  return { processing_status: processingNow(m).processing_status, error: m.processing_error || null };
});
on('POST', '/meetings/:code/process', ({ token, params }) => {
  const u = requireUser(token); const { m } = findMeeting(u, params.code);
  m.processing_status = 'waiting_uploads'; m.processing_started_at = Date.now(); m.processing_error = null; save(); return null;
});
on('GET', '/meetings/:code/transcript', ({ token, params }) => {
  const u = requireUser(token); const { w, m } = findMeeting(u, params.code); finalizeIfReady(w, m, u);
  const segs = (w.transcripts[m.code] || []).map((s, i) => ({ id: `${m.code}-${i}`, ...s, speaker_name: s.speaker_id === u.id ? u.full_name : s.speaker_name }));
  return { segments: segs };
});
on('GET', '/meetings/:code/summary', ({ token, params }) => {
  const u = requireUser(token); const { w, m } = findMeeting(u, params.code); finalizeIfReady(w, m, u);
  const s = w.summaries[m.code];
  if (!s) throw new ApiError(404, 'Minutes are not ready yet.');
  return s;
});
on('GET', '/meetings/:code/messages', ({ token, params }) => { const u = requireUser(token); const w = ws(u.id); return w.chats[params.code] || []; });
on('POST', '/meetings/:code/recordings', ({ token }) => { requireUser(token); return { ok: true }; });
on('GET', '/rtc/ice-servers', () => ({ ice_servers: [{ urls: 'stun:stun.l.google.com:19302' }] }));

// ── Action items ──
on('GET', '/action-items', ({ token, query = {} }) => {
  const u = requireUser(token); const w = ws(u.id);
  let list = [...w.items];
  if (query.status) list = list.filter((i) => i.status === query.status);
  if (query.meeting_code) list = list.filter((i) => i.meeting_code === query.meeting_code);
  if (query.mine === 'true') list = list.filter((i) => i.assignee_id === u.id);
  return list;
});
on('POST', '/action-items', ({ token, body }) => {
  const u = requireUser(token); const w = ws(u.id);
  body = { ...body, title: body.title ?? body.description };
  if (!body.title?.trim()) throw new ApiError(422, 'Give the task a title.');
  const m = body.meeting_code ? w.meetings.find((x) => x.code === body.meeting_code) : null;
  const it = { id: `ai-${Date.now().toString(36)}`, title: body.title.trim(), status: 'open', due_date: body.due_date || null, assignee_id: u.id, assignee_name: body.assignee_name || 'You', meeting_code: m?.code || null, meeting_title: m?.title || null, source: body.source || 'user', heard_at: body.heard_at ?? null };
  w.items.unshift(it); save(); return it;
});
on('PATCH', '/action-items/:id', ({ token, params, body }) => {
  const u = requireUser(token); const w = ws(u.id);
  const it = w.items.find((i) => i.id === params.id);
  if (!it) throw new ApiError(404, 'That task no longer exists.');
  const { description, ...rest } = body || {};
  Object.assign(it, rest, description !== undefined ? { title: description } : {}); save(); return it;
});
on('DELETE', '/action-items/:id', ({ token, params }) => {
  const u = requireUser(token); const w = ws(u.id);
  w.items = w.items.filter((i) => i.id !== params.id); save(); return null;
});

// ── Agent ──
on('GET', '/agent/conversations', ({ token }) => {
  const u = requireUser(token); return ws(u.id).conversations.map(({ id, title, updated_at, meeting_code }) => ({ id, title, updated_at, meeting_code })).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
});
on('GET', '/agent/conversations/:id', ({ token, params }) => {
  const u = requireUser(token); const c = ws(u.id).conversations.find((x) => x.id === params.id);
  if (!c) throw new ApiError(404, 'That conversation was deleted.');
  return c;
});
on('DELETE', '/agent/conversations/:id', ({ token, params }) => {
  const u = requireUser(token); const w = ws(u.id); w.conversations = w.conversations.filter((x) => x.id !== params.id); save(); return null;
});
on('POST', '/agent/actions/:id/confirm', ({ token, params }) => {
  const u = requireUser(token); const w = ws(u.id);
  for (const c of w.conversations) for (const msg of c.messages) {
    if (msg.confirm?.action_id === params.id) {
      msg.confirm.state = 'confirmed';
      const p = msg.confirm.payload;
      w.items.unshift({ id: `ai-${Date.now().toString(36)}`, title: p.title, status: 'open', due_date: p.due_date || null, assignee_id: u.id, assignee_name: p.assignee_name || 'You', meeting_code: p.meeting_code, meeting_title: p.meeting_title, source: 'assistant', heard_at: p.heard_at ?? null });
      save(); return { ok: true, result: 'Task created' };
    }
  }
  throw new ApiError(404, 'That action expired. Ask again.');
});
on('POST', '/agent/actions/:id/cancel', ({ token, params }) => {
  const u = requireUser(token); const w = ws(u.id);
  for (const c of w.conversations) for (const msg of c.messages) if (msg.confirm?.action_id === params.id) msg.confirm.state = 'cancelled';
  save(); return null;
});
on('POST', '/agent/messages/:id/feedback', () => null);

export async function handle(method, path, opts = {}) {
  await sleep(LATENCY);
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = path.match(r.re);
    if (m) {
      const res = r.fn({ ...opts, params: m.groups || {} });
      return res === undefined ? null : JSON.parse(JSON.stringify(res));
    }
  }
  throw new ApiError(404, `Not found: ${method} ${path}`);
}

/* ── Agent streaming (mock retrieval over the user's transcripts) ── */
const STOP = new Set('the a an and or of to in on for what did we about is was were do does how who when which that this it i you our my me with at be by from as are have has please tell can could would should make'.split(' '));
const words = (s) => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((x) => x && !STOP.has(x));

function retrieve(w, question, scope) {
  const q = words(question);
  const hits = [];
  for (const m of w.meetings) {
    if (scope && m.code !== scope) continue;
    (w.transcripts[m.code] || []).forEach((s) => {
      const t = words(s.text);
      let score = 0;
      q.forEach((x) => { if (t.some((y) => y.startsWith(x.slice(0, 5)))) score += 1; });
      if (score) hits.push({ score, m, s });
    });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 3);
}

export async function streamMock(path, body, onEvent, { signal } = {}) {
  const u = userFromToken((await import('@/lib/session')).session.token);
  if (!u) throw new ApiError(401, 'Your session has expired. Log in again.');
  const w = ws(u.id);
  const emit = async (event, data, wait = 0) => { if (signal?.aborted) throw new DOMException('Aborted', 'AbortError'); if (wait) await sleep(wait); onEvent({ event, data }); };
  const text = String(body.message || '');
  let conv = w.conversations.find((c) => c.id === body.conversation_id);
  if (!conv) {
    conv = { id: `c-${Date.now().toString(36)}`, title: text.slice(0, 60), meeting_code: body.meeting_code || null, updated_at: new Date().toISOString(), messages: [] };
    w.conversations.unshift(conv);
  }
  conv.messages.push({ id: `m-${Date.now().toString(36)}u`, role: 'user', content: text });
  const msgId = `m-${Date.now().toString(36)}a`;
  await emit('meta', { conversation_id: conv.id, message_id: msgId });

  const wantsTask = /\b(task|remind|todo|to-do|assign)\b/i.test(text);
  const scopeMeeting = body.meeting_code ? w.meetings.find((m) => m.code === body.meeting_code) : null;
  await emit('tool', { name: 'search_meetings', label: scopeMeeting ? `Searching ${scopeMeeting.title}` : 'Searching your meetings', status: 'running' }, 250);
  const hits = retrieve(w, text, body.meeting_code);
  await emit('tool', { name: 'search_meetings', label: hits.length ? `Found ${hits.length} relevant moment${hits.length > 1 ? 's' : ''}` : 'No matching moments', status: 'done' }, 500);

  let answer; let sources = []; let confirm = null;
  if (wantsTask) {
    const lastSrc = [...conv.messages].reverse().find((x) => x.sources?.length)?.sources?.[0] || (hits[0] && { meeting_code: hits[0].m.code, meeting_title: hits[0].m.title, start: hits[0].s.start });
    const who = (text.match(/for (\w+)/i) || [])[1];
    const title = (text.match(/(?:task|todo)[:\s]+(?:to\s+)?(.+?)(?: for \w+)?$/i) || [])[1] || (lastSrc ? `Follow up: ${hits[0]?.s.text.split(/[.,]/)[0] || 'from ' + lastSrc.meeting_title}` : 'Follow up from the assistant');
    await emit('tool', { name: 'create_action_item', label: 'Preparing a task', status: 'done' }, 300);
    confirm = { action_id: `act-${Date.now().toString(36)}`, kind: 'create_action_item', title: 'Create this task?', state: 'pending', payload: { title: title.charAt(0).toUpperCase() + title.slice(1), assignee_name: who ? who.charAt(0).toUpperCase() + who.slice(1) : 'You', meeting_code: lastSrc?.meeting_code || null, meeting_title: lastSrc?.meeting_title || null, heard_at: lastSrc?.start ?? null, due_date: null }, details: [] };
    confirm.details = [['Task', confirm.payload.title], ['Owner', confirm.payload.assignee_name], ...(confirm.payload.meeting_title ? [['From', confirm.payload.meeting_title]] : [])];
    answer = "Here's the task I'd create. Nothing changes until you confirm.";
  } else if (hits.length) {
    sources = hits.map((h, i) => ({ index: i + 1, meeting_code: h.m.code, meeting_title: h.m.title, start: h.s.start, speaker_name: h.s.speaker_name.split(' ')[0], text: h.s.text }));
    const top = hits[0];
    answer = `In **${top.m.title}**, ${top.s.speaker_name.split(' ')[0]} said: "${top.s.text}" [1]`;
    if (hits[1]) answer += `\n\nRelated: ${hits[1].s.speaker_name.split(' ')[0]} mentioned "${hits[1].s.text}" [2]`;
    if (hits[2]) answer += `\n\nAlso in ${hits[2].m.title}: "${hits[2].s.text}" [3]`;
  } else {
    answer = "I couldn't find that in your meetings. Try different words, or ask about a decision, a date or a task.";
  }

  for (const tok of answer.match(/\S+\s*/g) || []) await emit('token', { text: tok }, 18);
  if (sources.length) await emit('sources', sources);
  if (confirm) await emit('confirm', confirm);
  conv.messages.push({ id: msgId, role: 'assistant', content: answer, sources, confirm, tools: [{ label: hits.length ? `Found ${hits.length} relevant moment${hits.length > 1 ? 's' : ''}` : 'No matching moments' }] });
  conv.updated_at = new Date().toISOString();
  save();
  await emit('done', {});
}

export const _resetMockDb = () => { db = freshDb(); save(); };
