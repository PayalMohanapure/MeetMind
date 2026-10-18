import { useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router';
import { toast } from 'sonner';
import { Sun, Moon, Monitor, Check, Volume2, Mic, Video } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Field } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { VoiceAvatar } from '@/components/brand/VoiceAvatar';
import { LevelMeter } from '@/components/brand/Indicators';
import { useLocalMedia, devicePrefs } from '@/hooks/useMediaDevices';
import { useSpeakingLevel } from '@/hooks/useSpeakingLevel';
import { updateMe, changePassword } from '@/api/auth';
import { errorMessage } from '@/lib/errors';
import { features } from '@/config/features';
import { cn, storage } from '@/lib/utils';

const TABS = [
  ['profile', 'Profile'],
  ['appearance', 'Appearance'],
  ['audio-video', 'Audio and video'],
  ...(features.account ? [['password', 'Password']] : []),
];

function Card({ title, desc, children }) {
  return (
    <section className="card p-6">
      <h2 className="h-section">{title}</h2>
      {desc && <p className="text-ink-2 text-[14px] mt-1">{desc}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Profile() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const u = await updateMe({ full_name: name, email }); setUser((x) => ({ ...x, ...u })); toast('Profile saved'); } catch (x) { toast(errorMessage(x)); } finally { setBusy(false); }
  };
  return (
    <Card title="Profile" desc="Your name appears on your video tile and in transcripts.">
      <form onSubmit={save} className="space-y-4 max-w-[460px]">
        <div className="flex items-center gap-4"><VoiceAvatar id={user?.id} name={name} size={56} ring={false} /><div><p className="font-semibold">{user?.username}</p><p className="text-[13px] text-ink-3">Your colour is the same in every meeting.</p></div></div>
        <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
      </form>
    </Card>
  );
}

function Appearance() {
  const { theme, setTheme } = useTheme();
  const opts = [['daylight', 'Daylight', Sun, 'Bright and calm'], ['night', 'Night', Moon, 'Deep indigo, easy on the eyes'], ['system', 'Match system', Monitor, 'Follows your device']];
  return (
    <Card title="Appearance" desc="Meeting rooms always use the dark Dusk theme so faces stand out.">
      <div className="grid sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Theme">
        {opts.map(([v, l, Icon, d]) => (
          <button key={v} role="radio" aria-checked={theme === v} onClick={() => setTheme(v)} className={cn('relative text-left rounded-[18px] border-2 p-4 transition-colors', theme === v ? 'border-cobalt bg-cobalt-soft/40' : 'border-line hover:border-line-strong')}>
            <div className={cn('h-20 rounded-[12px] mb-3 border border-line', v === 'night' ? 'bg-[#10153A]' : v === 'system' ? 'bg-[linear-gradient(90deg,#EEF1FA_50%,#10153A_50%)]' : 'bg-[#EEF1FA]')}><div className={cn('m-2.5 h-[calc(100%-20px)] rounded-[8px]', v === 'night' ? 'bg-[#1A2050]' : v === 'system' ? 'bg-[linear-gradient(90deg,#fff_50%,#1A2050_50%)]' : 'bg-white')} /></div>
            <p className="font-semibold flex items-center gap-2"><Icon size={16} />{l}</p><p className="text-[13px] text-ink-2">{d}</p>
            {theme === v && <span className="absolute right-3 top-3 h-6 w-6 rounded-full bg-cobalt text-white grid place-items-center"><Check size={14} strokeWidth={3} /></span>}
          </button>
        ))}
      </div>
    </Card>
  );
}

function AudioVideo() {
  const media = useLocalMedia();
  const level = useSpeakingLevel(media.stream);
  const video = useRef(null);
  const [prefs, setPrefs] = useState(devicePrefs.get());
  const setP = (p) => { devicePrefs.set(p); setPrefs(devicePrefs.get()); };
  useEffect(() => { if (video.current && media.stream) video.current.srcObject = media.stream; }, [media.stream]);
  useEffect(() => { if (media.stream && level > 0.08) storage.set('mm-av-tested', true); }, [level, media.stream]);
  const testSpeaker = () => {
    try {
      const C = window.AudioContext || window.webkitAudioContext; const c = new C();
      const o = c.createOscillator(); const g = c.createGain(); o.frequency.value = 660; g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.2, c.currentTime + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.6);
      o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.65);
      storage.set('mm-av-tested', true);
    } catch { /* */ }
  };
  const Sel = ({ icon: Icon, label, list, kind }) => (
    <label className="block"><span className="field-label flex items-center gap-2"><Icon size={14} />{label}</span>
      <select className="input h-11 text-[14px]" value={media.sel[kind] || ''} onChange={(e) => media.choose(kind, e.target.value)}>
        <option value="">System default</option>{list.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `${label} ${i + 1}`}</option>)}
      </select>
    </label>
  );
  return (
    <Card title="Audio and video" desc="Defaults for every meeting. You can still change them in the lobby.">
      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-6">
        <div>
          <div className="relative aspect-video rounded-[18px] overflow-hidden bg-d1 grid place-items-center">
            {media.hasVideo ? <video ref={video} autoPlay playsInline muted className={cn('absolute inset-0 h-full w-full object-cover', prefs.mirror && '-scale-x-100')} /> : <p className="text-dt2 text-[14px] px-6 text-center">{media.error === 'denied' ? 'Camera access is blocked. Allow it in your browser’s site settings.' : 'No camera found.'}</p>}
          </div>
          <div className="mt-3"><LevelMeter segments={14} level={level} /></div>
          <p className="text-[13px] text-ink-2 mt-2">Speak to test your microphone.</p>
        </div>
        <div className="space-y-4">
          <Sel icon={Video} label="Camera" list={media.devices.cameras} kind="camera" />
          <Sel icon={Mic} label="Microphone" list={media.devices.mics} kind="mic" />
          {!!media.devices.speakers.length && <Sel icon={Volume2} label="Speaker" list={media.devices.speakers} kind="speaker" />}
          <button onClick={testSpeaker} className="btn btn-ghost"><Volume2 size={16} />Test speaker</button>
        </div>
      </div>
      <ul className="mt-6 divide-y divide-line border-t border-line">
        {[['mirror', 'Mirror my self-view', 'Others always see you the right way round.'], ['noiseSuppression', 'Noise suppression', 'Filters keyboard and fan noise.'], ['joinMuted', 'Join with microphone off', null], ['joinCamOff', 'Join with camera off', null]].map(([k, l, d]) => (
          <li key={k} className="flex items-center justify-between gap-4 py-4">
            <span><span className="block font-semibold text-[14.5px]">{l}</span>{d && <span className="block text-[13px] text-ink-2">{d}</span>}</span>
            <Switch checked={!!prefs[k]} onCheckedChange={(v) => { setP({ [k]: v }); if (k === 'noiseSuppression') media.setNoiseSuppression(v); }} aria-label={l} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Password() {
  const [cur, setCur] = useState(''); const [nw, setNw] = useState(''); const [busy, setBusy] = useState(false);
  return (
    <Card title="Password">
      <form className="space-y-4 max-w-[420px]" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await changePassword({ current_password: cur, new_password: nw }); toast('Password changed'); setCur(''); setNw(''); } catch (x) { toast(errorMessage(x)); } finally { setBusy(false); } }}>
        <Field label="Current password" type="password" reveal value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
        <Field label="New password" type="password" reveal value={nw} onChange={(e) => setNw(e.target.value)} autoComplete="new-password" hint="At least 8 characters." />
        <button className="btn btn-primary" disabled={busy}>Change password</button>
      </form>
    </Card>
  );
}

export default function Settings() {
  return (
    <div className="p-5 md:p-7 max-w-[1100px] grid md:grid-cols-[200px_1fr] gap-6 items-start">
      <nav className="flex md:flex-col gap-1 overflow-x-auto" aria-label="Settings">
        {TABS.map(([p, l]) => <NavLink key={p} to={`/app/settings/${p}`} className={({ isActive }) => cn('h-10 px-3 rounded-[12px] flex items-center text-[14px] font-semibold whitespace-nowrap', isActive ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:text-ink hover:bg-surface-2/60')}>{l}</NavLink>)}
      </nav>
      <div className="min-w-0">
        <Routes>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<Profile />} />
          <Route path="appearance" element={<Appearance />} />
          <Route path="audio-video" element={<AudioVideo />} />
          {features.account && <Route path="password" element={<Password />} />}
          <Route path="*" element={<Navigate to="profile" replace />} />
        </Routes>
      </div>
    </div>
  );
}
