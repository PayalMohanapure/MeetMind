import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Mic, MicOff, Video, VideoOff, Copy, Volume2, ChevronLeft, Settings2, ShieldAlert, RotateCw, FlipHorizontal } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useMeeting } from '@/hooks/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalMedia, devicePrefs } from '@/hooks/useMediaDevices';
import { useSpeakingLevel } from '@/hooks/useSpeakingLevel';
import { joinMeeting } from '@/api/meetings';
import { VoiceAvatar, AvatarStack } from '@/components/brand/VoiceAvatar';
import { LevelMeter, TallyLight, StatusBadge } from '@/components/brand/Indicators';
import { Logo } from '@/components/brand/Logo';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Switch } from '@/components/ui/Switch';
import { Checkbox } from '@/components/ui/Checkbox';
import { Tip } from '@/components/ui/Tooltip';
import { LoginForm, RegisterForm } from '@/components/auth/forms';
import { ErrorState, FullPageLoader } from '@/components/common/States';
import { roomSession } from '@/lib/roomSession';
import { inviteUrl, shortInvite } from '@/lib/inviteLink';
import { errorMessage } from '@/lib/errors';
import { cn, initials } from '@/lib/utils';
import { features } from '@/config/features';

function PermissionHelp({ onRetry }) {
  return (
    <div className="absolute inset-0 grid place-items-center p-6 text-center">
      <div className="max-w-[360px]">
        <ShieldAlert size={28} className="mx-auto text-sun" />
        <p className="mt-3 font-semibold text-white">Your browser blocked the camera and microphone.</p>
        <ol className="mt-3 text-left text-[13.5px] text-dt2 space-y-1.5 list-decimal pl-5">
          <li><b className="text-white">Chrome or Edge:</b> click the camera icon at the right end of the address bar, choose Allow.</li>
          <li><b className="text-white">Safari:</b> Safari menu, Settings for this website, set Camera and Microphone to Allow.</li>
          <li>Then press Try again.</li>
        </ol>
        <button onClick={onRetry} className="btn btn-white btn-sm mt-4"><RotateCw size={14} />Try again</button>
      </div>
    </div>
  );
}

function Preview({ media, level, name, mirror, setMirror }) {
  const v = useRef(null);
  useEffect(() => { if (v.current && media.stream) v.current.srcObject = media.stream; }, [media.stream]);
  return (
    <div className="dusk relative aspect-video rounded-[22px] overflow-hidden bg-d1 shadow-float" style={{ background: 'radial-gradient(120% 90% at 50% 0%, #2B3474 0%, #1C2350 60%)' }}>
      {media.stream && media.cam && media.hasVideo ? <video ref={v} autoPlay playsInline muted className={cn('absolute inset-0 h-full w-full object-cover', mirror && '-scale-x-100')} data-testid="self-preview" />
        : media.error === 'denied' ? <PermissionHelp onRetry={media.retry} />
        : <div className="absolute inset-0 grid place-items-center"><span className="h-24 w-24 rounded-[30px] grid place-items-center font-display font-bold text-[34px] text-white" style={{ background: 'linear-gradient(135deg,#4C6FFF,#7357F6)' }}>{initials(name)}</span><p className="absolute bottom-16 text-dt2 text-[14px]">{media.error === 'notfound' ? 'No camera found' : 'Camera is off'}</p></div>}
      <span className="absolute left-3 bottom-3 h-8 rounded-[10px] glass-dark px-3 inline-flex items-center gap-2 text-[13px] font-semibold">{media.mic && <LevelMeter level={level} />}{name}</span>
      {media.hasVideo && <Tip label={mirror ? 'Mirrored self-view' : 'True view'}><button onClick={() => setMirror(!mirror)} aria-pressed={mirror} className="absolute right-3 top-3 h-9 px-3 rounded-[10px] glass-dark inline-flex items-center gap-1.5 text-[12.5px] font-semibold"><FlipHorizontal size={14} />Mirror</button></Tip>}
    </div>
  );
}

export default function Lobby() {
  const { code } = useParams();
  const nav = useNavigate();
  const { user, status, isAuthed } = useAuth();
  const qc = useQueryClient();
  const meeting = useMeeting(code, { enabled: isAuthed, retry: false });
  const media = useLocalMedia();
  const level = useSpeakingLevel(media.stream);
  const [mirror, setMirrorS] = useState(devicePrefs.get().mirror);
  const setMirror = (v) => { setMirrorS(v); devicePrefs.set({ mirror: v }); };
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [showDevices, setShowDevices] = useState(false);
  // The backend only returns meetings you already joined; with just an invite link we show a generic card.
  const invited = meeting.isError && meeting.error?.status === 404;
  const m = meeting.data || (invited ? { code, title: `Meeting ${code}`, status: 'live', record: true, participants: [], invited: true } : undefined);
  useEffect(() => { document.title = `${m?.title || 'Join meeting'} · MeetMind`; }, [m?.title]);

  const join = async () => {
    setErr(null);
    if (m?.record && !consent) { setErr('Tick "I agree to be recorded" to join this meeting.'); return; }
    setBusy(true);
    try {
      const joined = await joinMeeting(code, { consent: m?.record ? consent : true });
      if (joined) qc.setQueryData(['meeting', code], joined);
      roomSession.enter(code, { stream: media.stream, mic: media.mic, cam: media.camWanted });
      media.streamRef.current = null; // hand the stream to the room instead of stopping it
      nav(`/app/meet/${code}`);
    } catch (e) { setErr(errorMessage(e)); setBusy(false); }
  };
  const testSpeaker = () => { try { const C = window.AudioContext || window.webkitAudioContext; const c = new C(); const o = c.createOscillator(); const g = c.createGain(); o.frequency.value = 660; g.gain.value = 0.15; o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.4); } catch { /* */ } };

  if (status === 'loading') return <FullPageLoader />;
  const name = user?.full_name || 'You';
  const ended = m?.status === 'ended';

  return (
    <div className="min-h-screen bg-canvas">
      <header className="h-16 px-4 md:px-8 flex items-center gap-4">
        <Link to={isAuthed ? '/app' : '/'} aria-label="MeetMind home"><Logo size={26} className="!text-[18px]" /></Link>
        {isAuthed && <Link to="/app" className="ml-auto inline-flex items-center gap-1 text-[14px] font-semibold text-ink-2 hover:text-ink"><ChevronLeft size={16} />Back to Home</Link>}
      </header>
      <main className="mx-auto max-w-[1180px] px-4 md:px-8 pb-12 pt-2 grid lg:grid-cols-[1.35fr_1fr] gap-6 lg:gap-10 items-start">
        <section aria-label="Camera and microphone check">
          <Preview media={media} level={level} name={name} mirror={mirror} setMirror={setMirror} />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button onClick={() => media.setMic(!media.mic)} aria-pressed={!media.mic} className={cn('btn h-12 px-4', media.mic ? 'btn-ghost' : 'bg-coral-soft text-coral-ink')}>{media.mic ? <Mic size={18} /> : <MicOff size={18} />}{media.mic ? 'Mic on' : 'Mic off'}</button>
            <button onClick={() => media.setCam(!media.cam)} disabled={!media.hasVideo} aria-pressed={!media.cam} className={cn('btn h-12 px-4', media.cam ? 'btn-ghost' : 'bg-coral-soft text-coral-ink')}>{media.cam ? <Video size={18} /> : <VideoOff size={18} />}{media.cam ? 'Camera on' : 'Camera off'}</button>
            <button onClick={() => setShowDevices(!showDevices)} aria-expanded={showDevices} className="btn btn-ghost h-12 px-4"><Settings2 size={18} />Devices</button>
            <button onClick={testSpeaker} className="btn btn-quiet h-12 px-4"><Volume2 size={18} />Test speaker</button>
          </div>
          <div className="mt-4"><LevelMeter segments={16} level={media.mic ? level : 0} /><p className="mt-1.5 text-[12.5px] text-ink-3">{media.mic ? 'Say something. The bar should move.' : 'Your microphone is off.'}</p></div>
          {showDevices && (
            <div className="mt-4 card p-4 grid sm:grid-cols-2 gap-3 anim-rise">
              {[['camera', 'Camera', media.devices.cameras], ['mic', 'Microphone', media.devices.mics], ...(media.devices.speakers.length ? [['speaker', 'Speaker', media.devices.speakers]] : [])].map(([k, l, list]) => (
                <label key={k} className="block"><span className="field-label">{l}</span><select className="input h-11 text-[14px]" value={media.sel[k] || ''} onChange={(e) => media.choose(k, e.target.value)}><option value="">System default</option>{list.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `${l} ${i + 1}`}</option>)}</select></label>
              ))}
              <label className="flex items-center justify-between gap-3 sm:col-span-2 pt-1"><span className="text-[14px] font-semibold">Noise suppression</span><Switch checked={media.noise} onCheckedChange={media.setNoiseSuppression} aria-label="Noise suppression" /></label>
              {features.bgBlur && <label className="flex items-center justify-between gap-3 sm:col-span-2"><span className="text-[14px] font-semibold">Background blur</span><Switch disabled aria-label="Background blur" /></label>}
            </div>
          )}
        </section>

        <section className="lg:pt-6" aria-label="Meeting">
          {!isAuthed ? (
            <div>
              <p className="text-[14px] text-ink-2">You're invited to a meeting</p>
              <h1 className="display text-[36px] mt-1">Join meeting <span className="tabnum text-ink-2 text-[24px] align-middle">{code}</span></h1>
              <p className="mt-3 text-ink-2">Log in or create a free account to join. You'll come straight back here.</p>
              <div className="mt-6 card p-5">
                <Tabs defaultValue="register">
                  <TabsList className="w-full grid grid-cols-2"><TabsTrigger value="register">Create account</TabsTrigger><TabsTrigger value="login">Log in</TabsTrigger></TabsList>
                  <TabsContent value="register" className="mt-5"><RegisterForm compact onSuccess={() => {}} /></TabsContent>
                  <TabsContent value="login" className="mt-5"><LoginForm compact onSuccess={() => {}} /></TabsContent>
                </Tabs>
              </div>
            </div>
          ) : meeting.isError && !invited ? (
            <ErrorState error={meeting.error} onRetry={meeting.refetch} />
          ) : !m ? (
            <div className="space-y-3"><div className="skeleton h-9 w-2/3" /><div className="skeleton h-5 w-1/2" /><div className="skeleton h-28" /></div>
          ) : ended ? (
            <div className="card p-6">
              <StatusBadge meeting={m} /><h1 className="display text-[32px] mt-3">This meeting has ended.</h1>
              <p className="mt-2 text-ink-2">{m.title} is over. {m.record ? 'Its transcript and minutes are on the record page.' : ''}</p>
              <div className="mt-5 flex gap-2"><Link to={`/app/meetings/${code}`} className="btn btn-primary">Open the record</Link><Link to="/app" className="btn btn-ghost">Go to Home</Link></div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">{m.invited ? <span className="badge badge-sched">Invitation</span> : <StatusBadge meeting={m} />}{m.record && <span className="badge badge-neutral"><TallyLight className="!text-[12px]" label={m.invited ? 'May be recorded' : 'Recorded'} /></span>}</div>
              <h1 className="display text-[36px] md:text-[40px] mt-3 leading-[1.02]">{m.title}</h1>
              <div className="mt-4 flex items-center gap-3">
                {m.participants?.length ? <><AvatarStack people={m.participants} size={30} /><span className="text-[14px] text-ink-2">{m.participants.length === 1 ? `${m.participants[0].full_name} is here` : `${m.participants.length} people invited or in the call`}</span></> : <span className="text-[14px] text-ink-2">No one else is here yet.</span>}
              </div>
              <button onClick={() => { navigator.clipboard?.writeText(inviteUrl(code)); toast('Invite link copied'); }} className="mt-5 w-full flex items-center gap-3 rounded-[14px] border border-line bg-surface px-4 h-12 text-left hover:bg-surface-2">
                <span className="flex-1 truncate text-[14px] text-ink-2">{shortInvite(code)}</span><span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-cobalt"><Copy size={15} />Copy link</span>
              </button>
              {m.record && (
                <div className="mt-5 rounded-[16px] bg-coral-soft/50 border border-coral-soft p-4">
                  <p className="text-[14px] flex gap-2"><TallyLight label="" /><span>This meeting is recorded. Your microphone audio is transcribed after the call.</span></p>
                  <label className="mt-3 flex items-center gap-3 cursor-pointer text-[14px] font-semibold"><Checkbox checked={consent} onCheckedChange={(v) => { setConsent(!!v); setErr(null); }} aria-label="I agree to be recorded" />I agree to be recorded</label>
                </div>
              )}
              {err && <p role="alert" className="mt-4 field-error">{err}</p>}
              <button onClick={join} disabled={busy} className="btn btn-primary btn-lg w-full mt-5">{busy ? 'Joining…' : 'Join meeting'}</button>
              <p className="mt-3 text-[13px] text-ink-3 text-center">Joining as <VoiceAvatar id={user?.id} name={name} size={18} ring={false} className="align-[-4px] mx-1" />{name}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
