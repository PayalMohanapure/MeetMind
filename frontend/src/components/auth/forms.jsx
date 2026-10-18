import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Play, AlertCircle } from 'lucide-react';
import { Field } from '@/components/ui/Field';
import { useAuth } from '@/context/AuthContext';
import { useStageStore } from '@/components/three/stageStore';
import { errorMessage } from '@/lib/errors';
import { features } from '@/config/features';
import { ServerWakeNotice } from './ServerWakeNotice';
import { sleep } from '@/lib/utils';

/** Releases at most 3 speech bubbles a second while typing in non-secret fields. */
function useTypingBursts() {
  const last = useRef(0);
  const emitBurst = useStageStore((s) => s.emitBurst);
  return () => { const n = performance.now(); if (n - last.current > 333) { last.current = n; emitBurst(); } };
}
function useCaps() {
  const [caps, setCaps] = useState(false);
  return [caps, (e) => setCaps(e.getModifierState?.('CapsLock'))];
}
const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/app');

export function DemoButton({ onDone }) {
  const { demo } = useAuth();
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  if (!features.demo) return null;
  return (
    <>
      <div className="flex items-center gap-3 my-6 text-[13px] text-ink-3"><span className="flex-1 h-px bg-line" />or<span className="flex-1 h-px bg-line" /></div>
      <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await demo(); onDone ? onDone() : nav('/app'); } catch (e) { toast(errorMessage(e)); setBusy(false); } }} className="btn btn-ghost btn-lg w-full"><Play size={15} className="text-cobalt" fill="currentColor" />{busy ? 'Opening the demo…' : 'Try the live demo'}</button>
      <p className="mt-2 text-center text-[13px] text-ink-3">Opens a sample workspace. No sign-up needed.</p>
    </>
  );
}

export function LoginForm({ onSuccess, compact }) {
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [caps, onKey] = useCaps();
  const burst = useTypingBursts();
  const { setFocusSpeaker, emitError, emitSuccess } = useStageStore.getState();

  const submit = async (e) => {
    e.preventDefault();
    if (!id.trim() || !pw) { setErr('Enter your email or username and your password.'); return; }
    setBusy(true); setErr(null);
    try {
      await login(id.trim(), pw);
      emitSuccess();
      if (onSuccess) return onSuccess();
      await sleep(400);
      nav(safeNext(params.get('next')), { replace: true });
    } catch (x) { setErr(errorMessage(x)); emitError(); setBusy(false); }
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4" onFocus={() => setFocusSpeaker(1)} onBlur={() => setFocusSpeaker(null)}>
      <Field label="Email or username" autoComplete="username" value={id} onChange={(e) => { setId(e.target.value); burst(); }} disabled={busy} autoFocus={!compact} />
      <div>
        <Field label="Password" type="password" reveal autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyUp={onKey} onKeyDown={onKey} disabled={busy} />
        {caps && <p className="field-hint flex items-center gap-1.5 !text-sun-ink"><AlertCircle size={13} />Caps Lock is on.</p>}
        {features.account && <div className="text-right mt-2"><Link to="/login?reset=1" className="text-[13px] link">Forgot password?</Link></div>}
      </div>
      {err && <p role="alert" className="flex gap-2 rounded-[12px] bg-coral-soft text-coral-ink text-[14px] font-medium p-3"><AlertCircle size={16} className="shrink-0 mt-0.5" />{err}</p>}
      <button className="btn btn-primary btn-lg w-full !mt-6" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      <ServerWakeNotice active={busy} />
    </form>
  );
}

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

export function RegisterForm({ onSuccess, compact }) {
  const { register } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [v, setV] = useState({ full_name: '', username: '', email: '', password: '' });
  const [errs, setErrs] = useState({});
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [caps, onKey] = useCaps();
  const burst = useTypingBursts();
  const { setFocusSpeaker, emitError, emitSuccess } = useStageStore.getState();
  const set = (k) => (e) => { setV((x) => ({ ...x, [k]: e.target.value })); if (errs[k]) setErrs((x) => ({ ...x, [k]: null })); if (k !== 'password') burst(); };

  const validate = () => {
    const e = {};
    if (v.full_name.trim().length < 2) e.full_name = 'Enter your full name.';
    if (!/^[A-Za-z0-9_]{3,50}$/.test(v.username)) e.username = 'Use 3–50 letters, numbers or underscores.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = 'Enter a valid email address.';
    if (v.password.length < 8) e.password = 'Use at least 8 characters.';
    setErrs(e);
    return !Object.keys(e).length;
  };
  const submit = async (e) => {
    e.preventDefault(); setErr(null);
    if (!validate()) { emitError(); return; }
    setBusy(true);
    try {
      await register({ ...v, full_name: v.full_name.trim() });
      emitSuccess();
      toast('Account created');
      if (onSuccess) return onSuccess();
      await sleep(400);
      nav(safeNext(params.get('next')), { replace: true });
    } catch (x) {
      if (Array.isArray(x.detail)) {
        const fe = {}; x.detail.forEach((d) => { const k = d.loc?.[d.loc.length - 1]; if (k) fe[k] = d.msg; }); setErrs(fe);
      } else setErr(errorMessage(x));
      emitError(); setBusy(false);
    }
  };
  const st = strength(v.password);
  const stLabel = ['Too short', 'Weak', 'Okay', 'Good', 'Strong', 'Very strong'][st];
  return (
    <form onSubmit={submit} noValidate className="space-y-4" onFocus={() => setFocusSpeaker(2)} onBlur={() => setFocusSpeaker(null)}>
      <Field label="Full name" autoComplete="name" value={v.full_name} onChange={set('full_name')} error={errs.full_name} disabled={busy} autoFocus={!compact} />
      <div className={compact ? 'space-y-4' : 'grid sm:grid-cols-2 gap-4'}>
        <Field label="Username" autoComplete="username" value={v.username} onChange={set('username')} error={errs.username} disabled={busy} />
        <Field label="Email" type="email" autoComplete="email" value={v.email} onChange={set('email')} error={errs.email} disabled={busy} />
      </div>
      <div>
        <Field label="Password" type="password" reveal autoComplete="new-password" value={v.password} onChange={set('password')} onKeyUp={onKey} error={errs.password} disabled={busy} />
        {v.password && !errs.password && (
          <div className="mt-2 flex items-center gap-2" aria-live="polite">
            <div className="flex gap-1 flex-1">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="h-1.5 flex-1 rounded-full transition-colors" style={{ background: i < st ? (st < 2 ? 'var(--coral)' : st < 4 ? 'var(--sun)' : 'var(--ok)') : 'var(--surface-3)' }} />)}</div>
            <span className="text-[12px] font-semibold text-ink-2 w-20 text-right">{stLabel}</span>
          </div>
        )}
        {caps && <p className="field-hint !text-sun-ink">Caps Lock is on.</p>}
      </div>
      {err && <p role="alert" className="flex gap-2 rounded-[12px] bg-coral-soft text-coral-ink text-[14px] font-medium p-3"><AlertCircle size={16} className="shrink-0 mt-0.5" />{err}</p>}
      <button className="btn btn-primary btn-lg w-full !mt-6" disabled={busy}>{busy ? 'Creating your account…' : 'Create account'}</button>
      <ServerWakeNotice active={busy} />
    </form>
  );
}
