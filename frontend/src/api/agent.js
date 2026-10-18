import { api } from '@/lib/api';
import { USE_MOCK } from '@/config/env';
import { streamPost } from '@/lib/sse';
import { AGENT } from './endpoints';
import { normSource } from './normalize';

export const listConversations = async () => (await api.get(AGENT.conversations)).map((c) => ({ ...c, updated_at: c.updated_at || c.updatedAt || c.createdAt || c.created_at }));
export const getConversation = async (id) => {
  const c = await api.get(AGENT.conversation(id));
  return { ...c, messages: (c.messages || []).filter((m) => m.role !== 'tool').map((m) => ({ ...m, sources: (m.sources || []).map(normSource) })) };
};
export const deleteConversation = (id) => api.del(AGENT.conversation(id));

const TOOL_LABEL = { search_meetings: 'Searched your meetings', get_meeting_summary: 'Read the minutes', list_action_items: 'Checked your tasks', create_action_item: 'Created a task', draft_followup_email: 'Drafted a follow-up email' };

/**
 * Same event interface as a stream (meta, tool, token, sources, done) so the chat UI works with
 * either backend. The real backend answers in one response from POST /agent/chat.
 */
export async function streamChat(body, onEvent, opts = {}) {
  if (USE_MOCK || AGENT.stream) return streamPost(AGENT.stream || '/agent/chat/stream', body, onEvent, opts);
  onEvent({ event: 'tool', data: { name: 'thinking', label: 'Thinking', status: 'running' } });
  const r = await api.post(AGENT.chat, { message: body.message, conversation_id: body.conversation_id }, { signal: opts.signal });
  onEvent({ event: 'meta', data: { conversation_id: r.conversationId || r.conversation_id } });
  onEvent({ event: 'tool', data: { name: 'thinking', label: 'Thought it through', status: 'done' } });
  for (const t of r.toolsUsed || r.tools_used || []) onEvent({ event: 'tool', data: { name: t, label: TOOL_LABEL[t] || t, status: 'done' } });
  // reveal the reply word by word so it reads like the streaming UI
  const words = String(r.reply || '').match(/\S+\s*/g) || [];
  for (const w of words) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    onEvent({ event: 'token', data: { text: w } });
    await new Promise((res) => setTimeout(res, 12));
  }
  const sources = (r.sources || []).map(normSource);
  if (sources.length) onEvent({ event: 'sources', data: sources });
  if ((r.toolsUsed || []).includes('create_action_item')) onEvent({ event: 'task_created', data: {} });
  onEvent({ event: 'done', data: {} });
}
export const chatOnce = (body) => api.post(AGENT.chat, body);
export const confirmAction = async () => null;
export const cancelAction = async () => null;
export const sendFeedback = async () => null;
