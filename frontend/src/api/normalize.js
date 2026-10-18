/**
 * Map backend responses (camelCase / snake_case, milliseconds, backend enum values) to the
 * shape the UI uses. Idempotent, so demo-mode data passes through unchanged.
 */
const pick = (o, ...keys) => { for (const k of keys) if (o?.[k] !== undefined && o?.[k] !== null) return o[k]; return undefined; };
const secs = (o, s, ...ms) => { const v = pick(o, s); if (v !== undefined) return Number(v); const m = pick(o, ...ms); return m === undefined ? undefined : Number(m) / 1000; };

// backend: none | pending | transcribing | embedding | summarizing | done | failed
const PROCESSING = { done: 'ready', pending: 'waiting_uploads' };
export const normProcessing = (s) => PROCESSING[s] || s || 'none';

export const normUser = (u) => u && ({ ...u, id: pick(u, 'id'), full_name: pick(u, 'full_name', 'fullName') || u.username, is_demo: !!pick(u, 'is_demo', 'isDemo'), created_at: pick(u, 'created_at', 'createdAt') });

export const normTokens = (t) => t && ({ ...t, access_token: pick(t, 'access_token', 'accessToken'), refresh_token: pick(t, 'refresh_token', 'refreshToken'), user: t.user ? normUser(t.user) : undefined });

const normParticipant = (p) => ({ ...p, user_id: pick(p, 'user_id', 'userId'), full_name: pick(p, 'full_name', 'fullName'), left_at: pick(p, 'left_at', 'leftAt') });

export function normMeeting(m) {
  if (!m) return m;
  const started = pick(m, 'started_at', 'startedAt');
  const ended = pick(m, 'ended_at', 'endedAt');
  const dur = pick(m, 'duration_seconds') ?? (started && ended ? (new Date(ended) - new Date(started)) / 1000 : 0);
  return {
    ...m,
    code: pick(m, 'code', 'meeting_code', 'meetingCode'),
    record: !!pick(m, 'record', 'recording_enabled', 'recordingEnabled'),
    processing_status: normProcessing(pick(m, 'processing_status', 'processingStatus')),
    processing_error: pick(m, 'processing_error', 'processingError'),
    host_id: pick(m, 'host_id', 'hostId'),
    is_host: pick(m, 'is_host', 'isHost'),
    created_at: pick(m, 'created_at', 'createdAt'),
    started_at: started,
    ended_at: ended,
    scheduled_at: pick(m, 'scheduled_at', 'scheduledAt'),
    duration_seconds: Math.max(0, Math.round(dur || 0)),
    participants: (pick(m, 'participants') || []).map(normParticipant),
  };
}

export const normSegment = (s, i) => ({
  ...s,
  id: s.id ?? `seg-${i}`,
  start: secs(s, 'start', 'start_ms', 'startMs') ?? 0,
  end: secs(s, 'end', 'end_ms', 'endMs'),
  speaker_id: pick(s, 'speaker_id', 'speakerUserId', 'speaker_user_id') || pick(s, 'speaker_name', 'speakerName'),
  speaker_name: pick(s, 'speaker_name', 'speakerName') || 'Unknown',
});
export const normTranscript = (t) => ({ ...t, segments: (t?.segments || t?.lines || (Array.isArray(t) ? t : [])).map(normSegment) });

const point = (x) => (typeof x === 'string' ? { text: x, start: null } : { ...x, start: x.start ?? null });
export const normSummary = (s) => s && ({
  ...s,
  summary: s.summary || '',
  decisions: (s.decisions || []).map(point),
  open_questions: (pick(s, 'open_questions', 'openQuestions') || []).map(point),
  key_points: (pick(s, 'key_points', 'keyPoints') || []).map(point),
  chapters: s.chapters || [],
  model_name: pick(s, 'model_name', 'modelName'),
});

// backend: ai_extracted | agent | manual
const SOURCE = { ai_extracted: 'ai', agent: 'assistant', manual: 'user' };
export function normTask(t) {
  if (!t) return t;
  return {
    ...t,
    title: pick(t, 'title', 'description') || '',
    status: t.status === 'done' ? 'done' : 'open',
    due_date: pick(t, 'due_date', 'dueDate') ?? null,
    assignee_id: pick(t, 'assignee_id', 'assigneeUserId', 'assignee_user_id'),
    created_by: pick(t, 'createdByUserId', 'created_by_user_id'),
    assignee_name: pick(t, 'assignee_name', 'assigneeName') || '',
    meeting_code: pick(t, 'meeting_code', 'meetingCode'),
    meeting_title: pick(t, 'meeting_title', 'meetingTitle'),
    source: SOURCE[t.source] || t.source || 'user',
    heard_at: secs(t, 'heard_at', 'source_start_ms', 'sourceStartMs') ?? null,
  };
}

export const normSource = (s, i) => ({
  ...s,
  index: pick(s, 'index') ?? i + 1,
  meeting_code: pick(s, 'meeting_code', 'meetingCode'),
  meeting_title: pick(s, 'meeting_title', 'meetingTitle'),
  start: secs(s, 'start', 'start_ms', 'startMs') ?? 0,
  speaker_name: pick(s, 'speaker_name', 'speakerName') || '',
  text: pick(s, 'text', 'snippet', 'content') || '',
});

export const normStatus = (s) => ({ ...s, processing_status: normProcessing(pick(s, 'processing_status', 'processingStatus')), error: pick(s, 'error', 'processing_error', 'processingError') });
export const listOf = (x) => (Array.isArray(x) ? x : x?.items || []);
