import { USE_MOCK } from '@/config/env';
import { session } from './session';
import { api, refreshSession } from './api';
import { ApiError } from './errors';

/** Parse an SSE text buffer into events. Returns [events, rest]. Exported for tests. */
export function parseSSE(buffer) {
  const events = [];
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop();
  for (const block of blocks) {
    let event = 'message';
    const data = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith(':')) continue;
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    if (!data.length) continue;
    const text = data.join('\n');
    let parsed = text;
    try { parsed = JSON.parse(text); } catch { /* plain text */ }
    events.push({ event, data: parsed });
  }
  return [events, rest];
}

/** POST and stream server-sent events. onEvent({event, data}). Returns when the stream ends. */
export async function streamPost(path, body, onEvent, { signal } = {}) {
  if (USE_MOCK) {
    const { streamMock } = await import('@/mock/server');
    return streamMock(path, body, onEvent, { signal });
  }
  const go = () => fetch(api.url(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}) },
    body: JSON.stringify(body),
    credentials: 'include',
    signal,
  });
  let res = await go();
  if (res.status === 401 && (await refreshSession())) res = await go();
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.detail || res.statusText);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const [events, rest] = parseSSE(buf);
    buf = rest;
    events.forEach(onEvent);
  }
  if (buf.trim()) parseSSE(buf + '\n\n')[0].forEach(onEvent);
}
