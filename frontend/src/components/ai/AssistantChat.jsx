import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import ReactMarkdown from 'react-markdown';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Square, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { streamChat, confirmAction, cancelAction } from '@/api/agent';
import { useConversation } from '@/hooks/queries';
import { errorMessage } from '@/lib/errors';
import { Stage } from '@/components/three/Stage';
import { CiteChip, SourceChip, ToolTimeline, ConfirmCard, FeedbackButtons } from './parts';
import { cn } from '@/lib/utils';
import { USE_MOCK } from '@/config/env';

const PROMPTS = USE_MOCK ? [
  'What did we decide about the launch date?',
  'What do I owe people this week?',
  'Summarise the last sprint review',
  'What is still unclear about pricing?',
] : [
  'What did we decide in my last meeting?',
  'What are my open tasks?',
  'Summarise my most recent meeting',
  'Draft a follow-up email for my last meeting',
];

function Answer({ msg }) {
  const text = (msg.content || '').replace(/\[(\d+)\]/g, '[$1](#cite-$1)');
  return (
    <div className="font-record text-[17px] leading-[1.6] text-ink [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown components={{ a: ({ href, children }) => { const m = href?.match(/^#cite-(\d+)$/); if (m) { const n = Number(m[1]); return <CiteChip n={n} source={msg.sources?.find((s) => s.index === n)} />; } return <a href={href} className="link" target="_blank" rel="noreferrer">{children}</a>; } }}>{text}</ReactMarkdown>
      {msg.streaming && <span className="inline-flex gap-1 ml-1 align-middle">{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-iris" style={{ animation: `dot-bounce 1s ${i * 0.15}s infinite` }} />)}</span>}
    </div>
  );
}

/** Chat with the MeetMind agent. `scope` = { code, title } limits it to one meeting. */
export function AssistantChat({ conversationId, scope: initialScope, compact, initialAsk, onConversation }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const own = useRef(null); // conversation created by this chat instance
  const conv = useConversation(conversationId && conversationId !== own.current ? conversationId : null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState(initialScope || null);
  const [convId, setConvId] = useState(conversationId || null);
  const abort = useRef(null);
  const end = useRef(null);
  const asked = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    if (conversationId && conversationId === own.current) return; // the URL caught up with a chat we just started
    own.current = null;
    setConvId(conversationId || null);
    if (!conversationId) setMessages([]);
  }, [conversationId]);
  useEffect(() => { if (conv.data && !busy) setMessages(conv.data.messages || []); }, [conv.data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (initialAsk && !asked.current) { asked.current = true; send(initialAsk); } }, [initialAsk]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchLast = (fn) => setMessages((ms) => { const c = [...ms]; c[c.length - 1] = fn(c[c.length - 1]); return c; });

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput(''); setBusy(true);
    setMessages((ms) => [...ms, { id: `u-${Date.now()}`, role: 'user', content: q }, { id: `a-${Date.now()}`, role: 'assistant', content: '', tools: [], sources: [], streaming: true }]);
    const ctl = new AbortController(); abort.current = ctl;
    let newId = convId;
    try {
      await streamChat({ message: scope && !convId ? `${q} (meeting code ${scope.code})` : q, conversation_id: convId || undefined, meeting_code: scope?.code }, ({ event, data }) => {
        if (event === 'meta') { newId = data.conversation_id; setConvId(data.conversation_id); patchLast((m) => ({ ...m, id: data.message_id || m.id })); }
        else if (event === 'tool') patchLast((m) => { const tools = [...(m.tools || [])]; const i = tools.findIndex((x) => x.name === data.name && x.status === 'running'); if (i >= 0) tools[i] = data; else tools.push(data); return { ...m, tools }; });
        else if (event === 'token') patchLast((m) => ({ ...m, content: m.content + (data.text ?? data) }));
        else if (event === 'sources') patchLast((m) => ({ ...m, sources: data }));
        else if (event === 'task_created') { qc.invalidateQueries({ queryKey: ['actionItems'] }); toast('Task created', { action: { label: 'Open', onClick: () => nav('/app/action-items') } }); }
        else if (event === 'confirm') patchLast((m) => ({ ...m, confirm: data }));
        else if (event === 'error') throw Object.assign(new Error(data.detail), { detail: data.detail });
      }, { signal: ctl.signal });
    } catch (e) {
      if (e.name !== 'AbortError') {
        const msg = e.status === 429 ? "You've asked a lot of questions in a short time. Wait a minute and try again." : errorMessage(e);
        patchLast((m) => ({ ...m, error: msg }));
      }
    } finally {
      patchLast((m) => ({ ...m, streaming: false }));
      setBusy(false); abort.current = null;
      qc.invalidateQueries({ queryKey: ['conversations'] });
      if (newId && !conversationId && !own.current && onConversation && alive.current) { own.current = newId; onConversation(newId); }
    }
  }

  const confirm = async (msg) => {
    try { await confirmAction(msg.confirm.action_id); patchLast2(msg.id, { state: 'confirmed' }); qc.invalidateQueries({ queryKey: ['actionItems'] }); toast('Task created', { action: { label: 'Open', onClick: () => nav('/app/action-items') } }); }
    catch (e) { toast(errorMessage(e)); }
  };
  const cancel = async (msg) => { await cancelAction(msg.confirm.action_id).catch(() => {}); patchLast2(msg.id, { state: 'cancelled' }); };
  const patchLast2 = (id, c) => setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, confirm: { ...m.confirm, ...c } } : m)));

  const empty = !messages.length;
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={cn('flex-1 min-h-0 overflow-y-auto scroll-thin', compact ? 'px-5 py-5' : 'px-4 md:px-8 py-6')} aria-live="polite" aria-busy={busy}>
        {empty ? (
          <div className="max-w-[640px] mx-auto pt-2 md:pt-6">
            {!compact && <div className="dusk aurora grain relative h-[220px] rounded-[28px] overflow-hidden mb-8"><Stage variant="mini" className="absolute inset-0" /></div>}
            <h2 className="display text-[30px] md:text-[34px]">{scope ? `Ask about ${scope.title}` : 'Ask about any meeting'}</h2>
            <p className="mt-2 text-ink-2">Answers come only from your meetings and list their sources. Ask me to create a task or draft a follow-up email.</p>
            <ul className="mt-6 border-t border-line">
              {(scope ? [`What was decided in ${scope.title}?`, `Who owes what after ${scope.title}?`, `Summarise ${scope.title} in three lines`, `Draft a follow-up email for ${scope.title}`] : PROMPTS).map((p) => (
                <li key={p}><button onClick={() => send(p)} className="w-full flex items-center gap-3 py-3.5 px-2 border-b border-line text-left text-[15px] font-medium hover:bg-surface-2 rounded-[10px]"><Sparkles size={16} className="text-iris shrink-0" />{p}</button></li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="max-w-[760px] mx-auto space-y-6">
            {messages.map((m, i) => m.role === 'user' ? (
              <div key={m.id || i} className="flex justify-end"><p className="max-w-[80%] rounded-[18px] rounded-br-[6px] bg-cobalt text-white px-4 py-2.5 text-[15px] whitespace-pre-wrap">{m.content}</p></div>
            ) : (
              <div key={m.id || i} className="anim-rise border-l-[3px] border-iris pl-4 md:pl-5">
                <ToolTimeline tools={m.tools} />
                {m.content ? <Answer msg={m} /> : m.streaming && <p className="text-ink-3 text-[14px]">Thinking…</p>}
                {m.error && <p role="alert" className="mt-2 rounded-[12px] bg-coral-soft text-coral-ink text-[14px] p-3">{m.error}</p>}
                {!!m.sources?.length && <div className="mt-4 grid gap-2"><p className="text-[12px] font-semibold text-ink-3">Sources</p>{m.sources.map((s) => <SourceChip key={s.index} s={s} />)}</div>}
                {m.confirm && <ConfirmCard c={m.confirm} onConfirm={() => confirm(m)} onCancel={() => cancel(m)} />}
                {!m.streaming && !m.error && <div className="mt-2 -ml-2"><FeedbackButtons id={m.id} /></div>}
                {!m.streaming && i === messages.length - 1 && !!m.sources?.length && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['Create a task for me to follow up on this', 'Draft a follow-up email for this meeting'].map((s) => <button key={s} onClick={() => send(s)} className="h-8 rounded-full border border-line px-3 text-[13px] font-semibold text-ink-2 hover:bg-surface-2">{s}</button>)}
                  </div>
                )}
              </div>
            ))}
            <div ref={end} />
          </div>
        )}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className={cn('shrink-0 border-t border-line bg-surface', compact ? 'p-4' : 'px-4 md:px-8 py-4')}>
        <div className="max-w-[760px] mx-auto">
          {scope && <span className="mb-2 inline-flex items-center gap-1.5 h-7 rounded-full bg-iris-soft text-iris-ink pl-3 pr-1 text-[12.5px] font-semibold">Only {scope.title}{!initialScope && <button type="button" onClick={() => setScope(null)} className="h-5 w-5 grid place-items-center rounded-full hover:bg-surface" aria-label="Search all meetings"><X size={12} /></button>}</span>}
          <div className="flex items-end gap-2 rounded-[18px] border border-line bg-surface-2 p-2 focus-within:border-cobalt focus-within:shadow-[0_0_0_4px_var(--cobalt-ring)] transition-shadow">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} placeholder={scope ? `Ask about ${scope.title}` : 'Ask MeetMind about your meetings'} aria-label="Message" className="flex-1 resize-none bg-transparent outline-none px-2 py-2 text-[15px] max-h-40 placeholder:text-ink-3" />
            {busy ? <button type="button" onClick={() => abort.current?.abort()} className="btn btn-ghost btn-icon h-10 w-10 shrink-0" aria-label="Stop"><Square size={14} fill="currentColor" /></button>
              : <button className="btn btn-primary btn-icon h-10 w-10 shrink-0" disabled={!input.trim()} aria-label="Send"><ArrowUp size={18} /></button>}
          </div>
        </div>
      </form>
    </div>
  );
}
