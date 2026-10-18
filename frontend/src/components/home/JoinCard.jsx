import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router';
import { Check, LogIn } from 'lucide-react';
import { parseMeetingCode } from '@/lib/inviteLink';
import { storage, cn } from '@/lib/utils';

export function JoinCard({ user, meetingsCount }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [v, setV] = useState('');
  const [err, setErr] = useState(null);
  const input = useRef(null);
  useEffect(() => { if (loc.state?.focusJoin) input.current?.focus(); }, [loc.state]);
  const submit = (e) => {
    e.preventDefault();
    const code = parseMeetingCode(v);
    if (!code) { setErr('That doesn’t look like a meeting code or link. Codes look like abc-defg-hij.'); return; }
    nav(`/app/meet/${code}/lobby`);
  };
  const checked = storage.get('mm-av-tested', false);
  const steps = [
    { label: 'Create account', done: true },
    { label: 'Test camera and mic', done: checked, to: '/app/settings/audio-video' },
    { label: 'Run your first meeting', done: meetingsCount > 0 && !user?.is_new },
  ];
  const showChecklist = user?.is_new && !steps.every((s) => s.done);
  return (
    <section className="card p-6 md:p-7 flex flex-col" aria-labelledby="join-h">
      <h2 id="join-h" className="h-section">Join with a code or link</h2>
      <form onSubmit={submit} className="mt-4 flex gap-2" noValidate>
        <input ref={input} value={v} onChange={(e) => { setV(e.target.value); setErr(null); }} placeholder="abc-defg-hij" aria-label="Meeting code or invite link" aria-invalid={err ? 'true' : undefined} className="input input-soft h-12 flex-1" />
        <button className="btn btn-primary h-12 px-5"><LogIn size={16} />Join</button>
      </form>
      {err ? <p className="field-error" role="alert">{err}</p> : <p className="field-hint">Or paste the full invite link.</p>}
      {showChecklist && (
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Getting started">
          {steps.map((s) => (
            <li key={s.label}>
              {s.to && !s.done ? <Link to={s.to} className="inline-flex items-center gap-2 h-9 rounded-full border border-line pl-1.5 pr-3.5 text-[13px] font-medium text-ink-2 hover:bg-surface-2"><span className="h-6 w-6 rounded-full border-[1.5px] border-line-strong" />{s.label}</Link>
                : <span className={cn('inline-flex items-center gap-2 h-9 rounded-full border border-line pl-1.5 pr-3.5 text-[13px] font-medium', s.done ? 'text-ink' : 'text-ink-2')}><span className={cn('h-6 w-6 rounded-full grid place-items-center', s.done ? 'bg-ok text-white' : 'border-[1.5px] border-line-strong')}>{s.done && <Check size={13} strokeWidth={3} />}</span>{s.label}</span>}
            </li>
          ))}
        </ul>
      )}
      {!showChecklist && (
        <div className="mt-auto pt-5 grid grid-cols-3 gap-2 text-center">
          {[['M', 'Mute'], ['V', 'Camera'], ['?', 'Shortcuts']].map(([k, l]) => <div key={k} className="rounded-[14px] bg-surface-2 py-3"><span className="kbd">{k}</span><p className="text-[12px] text-ink-2 mt-1.5">{l} in calls</p></div>)}
        </div>
      )}
    </section>
  );
}
