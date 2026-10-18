import { useState } from 'react';
import { Link } from 'react-router';
import { Check, Loader2, ThumbsUp, ThumbsDown, Search, Wrench } from 'lucide-react';
import { clock } from '@/lib/format';
import { sendFeedback } from '@/api/agent';
import { cn } from '@/lib/utils';

export const sourceHref = (s) => `/app/meetings/${s.meeting_code}?t=${Math.round(s.start || 0)}`;

export function CiteChip({ n, source }) {
  const inner = <span className="inline-grid place-items-center h-[18px] min-w-[18px] px-1 rounded-[6px] bg-iris text-white text-[11px] font-bold font-ui align-[2px] mx-0.5 hover:brightness-110">{n}</span>;
  return source ? <Link to={sourceHref(source)} aria-label={`Source ${n}: ${source.meeting_title} at ${clock(source.start)}`}>{inner}</Link> : inner;
}

export function SourceChip({ s }) {
  return (
    <Link to={sourceHref(s)} className="group flex items-start gap-2.5 rounded-[12px] bg-iris-soft px-3 py-2.5 hover:brightness-[.98] transition">
      <span className="h-5 min-w-5 px-1 rounded-[6px] bg-iris text-white text-[11px] font-bold grid place-items-center mt-0.5">{s.index}</span>
      <span className="min-w-0 text-[13px]">
        <span className="flex flex-wrap gap-x-2.5 font-semibold text-ink"><span>{s.meeting_title}</span><span className="tabnum text-ink-2 font-medium">{clock(s.start)}</span><span className="text-ink-2 font-medium">{s.speaker_name}</span></span>
        {s.text && <span className="block text-ink-2 font-record text-[14px] leading-snug mt-0.5 line-clamp-2">"{s.text}"</span>}
      </span>
    </Link>
  );
}

export function ToolTimeline({ tools = [] }) {
  if (!tools.length) return null;
  return (
    <ol className="mb-3 space-y-1.5" aria-label="What the assistant did">
      {tools.map((t, i) => (
        <li key={i} className="flex items-center gap-2 text-[13px] text-ink-2">
          <span className={cn('h-5 w-5 rounded-full grid place-items-center', t.status === 'running' ? 'bg-iris-soft text-iris' : 'bg-ok-soft text-ok')}>
            {t.status === 'running' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} strokeWidth={3} />}
          </span>
          {t.name?.includes('search') ? <Search size={13} /> : <Wrench size={13} />}{t.label}
        </li>
      ))}
    </ol>
  );
}

export function ConfirmCard({ c, onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);
  const state = c.state || 'pending';
  return (
    <div className="mt-3 rounded-[16px] border border-line bg-surface p-4 shadow-raise">
      <p className="font-semibold">{c.title || 'Confirm this action?'}</p>
      <dl className="mt-2 grid grid-cols-[80px_1fr] gap-y-1 text-[14px]">
        {(c.details || []).map(([k, v]) => <div key={k} className="contents"><dt className="text-ink-3">{k}</dt><dd className="font-medium">{v}</dd></div>)}
      </dl>
      {state === 'pending' ? (
        <div className="mt-4 flex gap-2">
          <button disabled={busy} onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }} className="btn btn-primary btn-sm">{busy ? 'Creating…' : 'Create task'}</button>
          <button disabled={busy} onClick={onCancel} className="btn btn-ghost btn-sm">Cancel</button>
        </div>
      ) : <p className={cn('mt-3 text-[13px] font-semibold', state === 'confirmed' ? 'text-ok-ink' : 'text-ink-3')}>{state === 'confirmed' ? 'Task created.' : 'Cancelled. Nothing was changed.'}</p>}
    </div>
  );
}

export function FeedbackButtons({ id }) {
  const [v, setV] = useState(0);
  const send = (r) => { setV(r); if (id) sendFeedback(id, r).catch(() => {}); };
  return (
    <div className="flex gap-1">
      <button onClick={() => send(1)} aria-pressed={v === 1} aria-label="Helpful" className={cn('h-8 w-8 rounded-[9px] grid place-items-center hover:bg-surface-2', v === 1 ? 'text-ok' : 'text-ink-3')}><ThumbsUp size={15} /></button>
      <button onClick={() => send(-1)} aria-pressed={v === -1} aria-label="Not helpful" className={cn('h-8 w-8 rounded-[9px] grid place-items-center hover:bg-surface-2', v === -1 ? 'text-coral' : 'text-ink-3')}><ThumbsDown size={15} /></button>
    </div>
  );
}
