import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Mic, MicOff, Video, VideoOff, MonitorUp, MonitorX, Captions, Hand, MessageSquare, Users, MoreHorizontal, PhoneOff, LayoutGrid, Keyboard, PictureInPicture2, Smile, Copy, Flag, X, Wifi } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { queryClient } from '@/lib/queryClient';
import { useMeeting } from '@/hooks/queries';
import { useRoom } from '@/hooks/useRoom';
import { useRecorder } from '@/hooks/useRecorder';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useSpeakingLevel } from '@/hooks/useSpeakingLevel';
import { devicePrefs } from '@/hooks/useMediaDevices';
import { VideoTile, InviteTile, ChatPanel, PeoplePanel, DockButton } from '@/components/meeting/parts';
import { TallyLight } from '@/components/brand/Indicators';
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from '@/components/ui/Menu';
import { Dialog } from '@/components/ui/Dialog';
import { leaveMeeting, endMeeting } from '@/api/meetings';
import { roomSession } from '@/lib/roomSession';
import { inviteUrl } from '@/lib/inviteLink';
import { clock } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { features } from '@/config/features';
import { cn } from '@/lib/utils';

const SHORTCUTS = [['M', 'Mute or unmute'], ['V', 'Camera on or off'], ['S', 'Share your screen'], ['C', 'Open chat'], ...(features.raiseHand ? [['H', 'Raise or lower hand']] : []), ...(features.captions ? [['K', 'Captions on or off']] : []), ['?', 'Show shortcuts']];

function useElapsed(since) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  return since ? Math.max(0, (now - new Date(since).getTime()) / 1000) : 0;
}

function gridFor(n) {
  if (n <= 1) return 'grid-cols-1 grid-rows-1';
  if (n === 2) return 'grid-cols-1 sm:grid-cols-2 grid-rows-2 sm:grid-rows-1';
  if (n <= 4) return 'grid-cols-2 grid-rows-2';
  return 'grid-cols-2 sm:grid-cols-3 grid-rows-3 sm:grid-rows-2';
}

export default function MeetingRoom() {
  const { code } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const passed = roomSession.hasPassed(code);
  const meeting = useMeeting(code, { enabled: passed });
  const m = meeting.data;
  const [stream, setStream] = useState(() => roomSession.take(code));
  const [mic, setMic] = useState(roomSession.code === code ? roomSession.mic : !devicePrefs.get().joinMuted);
  const [cam, setCam] = useState(roomSession.code === code ? roomSession.cam : !devicePrefs.get().joinCamOff);
  const [screen, setScreenS] = useState(null);
  const [panel, setPanel] = useState(null); // 'chat' | 'people' | null
  const [captions, setCaptions] = useState(features.captions);
  const [hand, setHand] = useState(false);
  const [layout, setLayout] = useState('grid'); // grid | speaker
  const [pinned, setPinned] = useState(null);
  const [shortcuts, setShortcuts] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [banner, setBanner] = useState(null);
  const [unread, setUnread] = useState(0);
  const [isPhone] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  const mirror = devicePrefs.get().mirror;
  const leaving = useRef(false);

  // Re-acquire media after a reload (the lobby stream only lives in memory).
  useEffect(() => {
    if (stream || !passed) return;
    navigator.mediaDevices?.getUserMedia({ audio: { noiseSuppression: devicePrefs.get().noiseSuppression, echoCancellation: true }, video: true })
      .catch(() => navigator.mediaDevices.getUserMedia({ audio: true }))
      .then(setStream).catch(() => toast("Couldn't access your microphone. Others won't hear you."));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { stream?.getAudioTracks().forEach((t) => (t.enabled = mic)); }, [mic, stream]);
  useEffect(() => { stream?.getVideoTracks().forEach((t) => (t.enabled = cam)); }, [cam, stream]);
  // Stop camera/mic only on a real unmount (React StrictMode runs effects twice in dev).
  const mediaRef = useRef({ stream: null, screen: null });
  mediaRef.current = { stream, screen };
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const { stream: s, screen: sc } = mediaRef.current;
      setTimeout(() => { if (!mounted.current) [s, sc].forEach((x) => x?.getTracks().forEach((t) => t.stop())); }, 0);
    };
  }, []);

  const room = useRoom({ code, user, localStream: stream, mic, cam, hand, enabled: passed && !!m && m.status !== 'ended' });
  const rec = useRecorder({ code, stream, enabled: !!m?.record && passed && m?.status === 'live', meetingStartedAt: m?.started_at });
  const elapsed = useElapsed(m?.started_at);
  const isHost = m?.is_host;

  // Wake lock + leave warning
  useEffect(() => {
    let lock;
    navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    const before = (e) => { if (!leaving.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', before);
    return () => { lock?.release?.(); window.removeEventListener('beforeunload', before); };
  }, []);
  useEffect(() => { if (m) document.title = `${m.title} · MeetMind`; }, [m]);

  // Speaking while muted → banner (once per occurrence)
  const rawLevel = useSpeakingLevel(!mic ? stream : null, { measureMuted: true });
  const loudSince = useRef(0);
  useEffect(() => {
    if (mic) { loudSince.current = 0; if (banner?.kind === 'muted') setBanner(null); return; }
    if (rawLevel > 0.18) { if (!loudSince.current) loudSince.current = Date.now(); else if (Date.now() - loudSince.current > 500) setBanner({ kind: 'muted', text: "You're muted. Press M to unmute.", tone: 'sun' }); }
    else loudSince.current = 0;
  }, [rawLevel, mic]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (room.connection === 'lost' || room.connection === 'unstable') setBanner({ kind: 'net', text: 'Your connection is unstable. Reconnecting…', tone: 'coral' });
    else if (banner?.kind === 'net') setBanner({ kind: 'netok', text: 'Reconnected', tone: 'ok' });
  }, [room.connection]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (banner?.kind === 'netok' || banner?.kind === 'info') { const t = setTimeout(() => setBanner(null), 3000); return () => clearTimeout(t); } }, [banner]);
  useEffect(() => { if (m?.record && m?.status === 'live') setBanner((b) => b || { kind: 'info', text: 'Recording started', tone: 'neutral' }); }, [m?.record, m?.status]);
  useEffect(() => { if (room.error) toast(room.error); }, [room.error]);
  useEffect(() => { if (room.ended) { toast('The host ended the meeting'); leave(true); } }, [room.ended]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const last = room.messages[room.messages.length - 1]; if (last && !last.self && panel !== 'chat') setUnread((n) => n + 1); }, [room.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (panel === 'chat') setUnread(0); }, [panel]);

  const toggleShare = async () => {
    if (screen) { screen.getTracks().forEach((t) => t.stop()); setScreenS(null); room.setScreen(null); return; }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      s.getVideoTracks()[0].addEventListener('ended', () => { setScreenS(null); room.setScreen(null); });
      setScreenS(s); room.setScreen(s);
    } catch { /* user cancelled */ }
  };
  const toggleHand = () => { const v = !hand; setHand(v); if (v) toast('Hand raised'); };

  async function leave(skipApi) {
    leaving.current = true;
    await rec.stop().catch(() => {});
    if (!skipApi) await leaveMeeting(code).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['meeting', code] }); queryClient.invalidateQueries({ queryKey: ['meetings'] });
    nav(`/app/meet/${code}/ended`, { replace: true });
  }
  const endForAll = async () => {
    try { leaving.current = true; await rec.stop().catch(() => {}); await endMeeting(code); queryClient.invalidateQueries({ queryKey: ['meeting', code] }); queryClient.invalidateQueries({ queryKey: ['meetings'] }); toast('Meeting ended for everyone'); nav(`/app/meet/${code}/ended`, { replace: true }); }
    catch (e) { toast(errorMessage(e)); }
  };
  const pip = async () => {
    const v = document.querySelector('[data-testid="tile"] video, [data-testid="tile-self"] video');
    if (v && document.pictureInPictureEnabled) { try { await v.requestPictureInPicture(); } catch { toast("Picture-in-picture isn't available here."); } }
    else toast('Picture-in-picture needs someone with their camera on.');
  };

  useHotkeys({
    m: () => setMic((x) => !x),
    v: () => setCam((x) => !x),
    s: () => !isPhone && toggleShare(),
    c: () => setPanel((p) => (p === 'chat' ? null : 'chat')),
    h: () => features.raiseHand && toggleHand(),
    k: () => features.captions && setCaptions((x) => !x),
    '?': () => setShortcuts(true),
  });

  const me = { sid: 'me', user_id: user?.id, display_name: user?.full_name || 'You', mic, cam, hand, stream, host: isHost };
  const peers = room.peers;
  const people = peers.length + 1;
  const speakerPeer = useMemo(() => peers.find((p) => p.sid === pinned) || peers.find((p) => p.speaking) || peers[0], [peers, pinned]);
  const stageTiles = [...peers.map((p) => ({ p, self: false })), { p: me, self: true }];
  const showInvite = !screen && layout === 'grid' && stageTiles.length < 6 && !isPhone;
  const n = stageTiles.length + (showInvite ? 1 : 0);
  const caption = captions && room.caption && Date.now() - room.caption.at < 6000 ? room.caption : null;

  if (!passed) return <Navigate to={`/app/meet/${code}/lobby`} replace />;

  const Speaker = speakerPeer && (layout === 'speaker' || screen || isPhone);
  return (
    <div className="dusk h-[100svh] grid grid-rows-[56px_1fr_56px_auto] overflow-hidden" style={{ background: 'radial-gradient(120% 80% at 50% -10%, #232C66 0%, var(--d0) 60%)' }}>
      {/* Top bar */}
      <header className="flex items-center gap-2.5 px-4 md:px-5 min-w-0">
        <h1 className="font-semibold text-[15px] truncate min-w-0 max-w-[34vw]">{m?.title || 'Meeting'}</h1>
        <button onClick={() => { navigator.clipboard?.writeText(inviteUrl(code)); toast('Invite link copied'); }} className="hidden sm:inline-flex h-[30px] rounded-full border border-dl bg-d1 px-3 items-center gap-1.5 text-[13px] text-dt2 tabnum hover:text-dt" aria-label="Copy invite link">{code}<Copy size={12} /></button>
        {m?.record && <span className="h-[30px] shrink-0 rounded-full border border-dl bg-d1 px-3 inline-flex items-center text-[#FFB3AB]"><TallyLight className="!text-[13px] [&>span:last-child]:max-sm:sr-only" label={<span>Recording</span>} /></span>}
        <span className="h-[30px] shrink-0 rounded-full border border-dl bg-d1 px-3 inline-flex items-center text-[13px] text-dt2 tabnum" aria-label="Elapsed time">{clock(elapsed)}</span>
        {room.connection !== 'ok' && room.connection !== 'connecting' && <span className="h-[30px] rounded-full bg-coral-soft text-coral-ink px-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold"><Wifi size={13} />Unstable</span>}
        <span className="ml-auto h-[30px] shrink-0 rounded-full border border-dl bg-d1 px-3 inline-flex items-center text-[13px] text-dt2" data-testid="people-count">{people} {people === 1 ? 'person' : 'people'}</span>
      </header>

      {/* Stage + side panel */}
      <main className="min-h-0 px-3 md:px-4 grid gap-3" style={{ gridTemplateColumns: panel && !isPhone ? '1fr 340px' : '1fr' }}>
        <section className="relative min-h-0" aria-label="Participants">
          {screen ? (
            <div className="h-full grid grid-cols-[1fr_200px] gap-3 max-md:grid-cols-1">
              <div className="relative rounded-tile overflow-hidden bg-d1 grid place-items-center">
                <video autoPlay playsInline muted ref={(el) => { if (el && el.srcObject !== screen) el.srcObject = screen; }} className="h-full w-full object-contain" />
                <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-[14px] bg-sun text-[#1A2042] pl-4 pr-1.5 py-1.5 font-semibold text-[14px] shadow-float">You're presenting<button onClick={toggleShare} className="btn btn-sm bg-[#1A2042] text-white">Stop presenting</button></div>
              </div>
              <div className="flex md:flex-col gap-3 overflow-auto scroll-thin">{stageTiles.map(({ p, self }) => <VideoTile key={p.sid} p={p} self={self} mirror={mirror} compact className="shrink-0 h-[120px] w-[200px] md:w-full" />)}</div>
            </div>
          ) : Speaker ? (
            <div className="h-full grid grid-rows-[1fr_auto] gap-3">
              <VideoTile p={speakerPeer} mirror={mirror} pinned={pinned === speakerPeer.sid} onPin={() => setPinned(pinned === speakerPeer.sid ? null : speakerPeer.sid)} className="h-full" />
              <div className="flex gap-3 overflow-x-auto scroll-thin pb-1">
                {stageTiles.filter(({ p }) => p.sid !== speakerPeer.sid).map(({ p, self }) => <VideoTile key={p.sid} p={p} self={self} mirror={mirror} compact onPin={self ? undefined : () => setPinned(p.sid)} className="shrink-0 h-[96px] w-[150px]" />)}
              </div>
            </div>
          ) : (
            <div className={cn('h-full grid gap-3', gridFor(n))}>
              {stageTiles.map(({ p, self }) => <VideoTile key={p.sid} p={p} self={self} mirror={mirror} pinned={pinned === p.sid} onPin={self ? undefined : () => { setPinned(p.sid); setLayout('speaker'); }} />)}
              {showInvite && <InviteTile code={code} />}
            </div>
          )}
          {/* reactions */}
          <div className="pointer-events-none absolute bottom-3 left-4 flex flex-col-reverse gap-1" aria-live="polite">
            {room.reactions.map((r) => <span key={r.id} className="text-[30px] anim-rise">{r.emoji}</span>)}
          </div>
        </section>
        {panel && (
          <aside className={cn('rounded-[20px] border border-dl bg-d1 flex flex-col min-h-0 overflow-hidden', isPhone && 'fixed inset-x-2 bottom-[96px] top-16 z-30 shadow-float')} aria-label={panel === 'chat' ? 'Chat' : 'People'}>
            <div className="flex items-center gap-1.5 p-2.5 border-b border-dl">
              {[['chat', 'Chat'], ['people', `People ${people}`]].map(([k, l]) => <button key={k} onClick={() => setPanel(k)} aria-pressed={panel === k} className={cn('h-8 px-3 rounded-[10px] text-[13px] font-semibold', panel === k ? 'bg-d2 text-dt' : 'text-dt2 hover:text-dt')}>{l}</button>)}
              <button onClick={() => setPanel(null)} className="ml-auto h-8 w-8 grid place-items-center rounded-[10px] text-dt2 hover:bg-d2" aria-label="Close panel"><X size={16} /></button>
            </div>
            {panel === 'chat' ? <ChatPanel messages={room.messages} onSend={room.send} /> : <PeoplePanel me={me} peers={peers} />}
          </aside>
        )}
      </main>

      {/* Reserved status strip: captions + one banner, never over tiles */}
      <div className="flex items-center justify-center gap-3 px-4 min-w-0" aria-live="polite">
        {caption && <p className="max-w-[min(720px,70%)] rounded-[14px] bg-[rgba(14,18,44,.78)] px-4 py-2 text-[15px] md:text-[16px] leading-snug line-clamp-2" data-testid="caption"><b style={{ color: '#FFB08A' }} className="font-semibold mr-1.5">{(caption.display_name || '').split(' ')[0]}</b>{caption.text}</p>}
        {banner && <p data-testid="banner" className={cn('rounded-[12px] px-3.5 py-2 text-[13px] font-semibold shrink-0 shadow-float', banner.tone === 'sun' ? 'bg-sun text-[#1A2042]' : banner.tone === 'coral' ? 'bg-coral text-white' : banner.tone === 'ok' ? 'bg-ok text-white' : 'bg-d2 text-dt')}>{banner.text}</p>}
        {!!rec.pending && <span className="text-[12px] text-dt2 shrink-0" data-testid="uploading">Uploading audio…</span>}
        {!!rec.uploaded && !rec.pending && <span className="sr-only" data-testid="uploaded">{rec.uploaded} recording uploaded</span>}
      </div>

      {/* Dock */}
      <footer className="flex justify-center px-2 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="flex gap-1 sm:gap-1.5 md:gap-2 p-1.5 sm:p-2 md:p-2.5 rounded-[22px] bg-[rgba(28,35,80,.72)] border border-dl backdrop-blur-xl shadow-float overflow-x-auto max-w-full" role="toolbar" aria-label="Call controls">
          <DockButton icon={mic ? Mic : MicOff} label={mic ? 'Mute' : 'Unmute'} off={!mic} pressed={!mic} onClick={() => setMic(!mic)} hint="M" />
          <DockButton icon={cam ? Video : VideoOff} label="Camera" off={!cam} pressed={!cam} onClick={() => setCam(!cam)} hint="V" disabled={!stream?.getVideoTracks().length} />
          {!isPhone && <DockButton icon={screen ? MonitorX : MonitorUp} label={screen ? 'Stop' : 'Share'} active={!!screen} pressed={!!screen} onClick={toggleShare} hint="S" />}
          {!isPhone && features.captions && <DockButton icon={Captions} label="Captions" active={captions} pressed={captions} onClick={() => setCaptions(!captions)} hint="K" />}
          {!isPhone && features.raiseHand && <DockButton icon={Hand} label="Raise" active={hand} pressed={hand} onClick={toggleHand} hint="H" />}
          {!isPhone && features.reactions && (
            <Menu>
              <MenuTrigger asChild><span><DockButton icon={Smile} label="React" /></span></MenuTrigger>
              <MenuContent dusk side="top" align="center" className="!min-w-0 flex gap-1 p-1.5">
                {['👍', '👏', '😂', '🎉', '❤️', '🤔'].map((e) => <button key={e} onClick={() => room.react(e)} className="h-10 w-10 rounded-[10px] text-[22px] hover:bg-d3" aria-label={`React ${e}`}>{e}</button>)}
              </MenuContent>
            </Menu>
          )}
          <span className="w-px bg-dl my-1.5 mx-0.5" />
          <span className="relative"><DockButton icon={MessageSquare} label="Chat" active={panel === 'chat'} pressed={panel === 'chat'} onClick={() => setPanel(panel === 'chat' ? null : 'chat')} hint="C" />{!!unread && <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-coral text-white text-[11px] font-bold grid place-items-center">{unread}</span>}</span>
          {!isPhone && <DockButton icon={Users} label="People" active={panel === 'people'} pressed={panel === 'people'} onClick={() => setPanel(panel === 'people' ? null : 'people')} />}
          <Menu>
            <MenuTrigger asChild><span><DockButton icon={MoreHorizontal} label="More" /></span></MenuTrigger>
            <MenuContent dusk side="top" align="center">
              <MenuItem icon={LayoutGrid} onSelect={() => { setLayout(layout === 'grid' ? 'speaker' : 'grid'); setPinned(null); }}>{layout === 'grid' ? 'Speaker view' : 'Grid view'}</MenuItem>
              <MenuItem icon={PictureInPicture2} onSelect={pip}>Picture-in-picture</MenuItem>
              <MenuItem icon={Keyboard} onSelect={() => setShortcuts(true)} hint="?">Keyboard shortcuts</MenuItem>
              <MenuItem icon={Copy} onSelect={() => { navigator.clipboard?.writeText(inviteUrl(code)); toast('Invite link copied'); }}>Copy invite link</MenuItem>
              {isPhone && <MenuItem icon={Users} onSelect={() => setPanel('people')}>People</MenuItem>}
              <MenuSeparator />
              <MenuItem icon={Flag} onSelect={() => toast('Thanks. Describe the problem in Settings → Feedback when it is available.')}>Report a problem</MenuItem>
            </MenuContent>
          </Menu>
          <span className="w-px bg-dl my-1.5 mx-0.5" />
          {isHost ? (
            <Menu>
              <MenuTrigger asChild><span><DockButton icon={PhoneOff} label="Leave" danger /></span></MenuTrigger>
              <MenuContent dusk side="top" align="end">
                <MenuItem icon={PhoneOff} danger onSelect={() => setConfirmEnd(true)} hint={m?.record ? 'writes minutes' : ''}>End for everyone</MenuItem>
                <MenuItem icon={PhoneOff} onSelect={() => leave()}>Leave the call</MenuItem>
              </MenuContent>
            </Menu>
          ) : <DockButton icon={PhoneOff} label="Leave" danger onClick={() => leave()} />}
        </div>
      </footer>

      <Dialog dusk open={shortcuts} onOpenChange={setShortcuts} title="Keyboard shortcuts">
        <ul className="divide-y divide-dl">{SHORTCUTS.map(([k, l]) => <li key={k} className="flex items-center justify-between py-3 text-[14px]"><span>{l}</span><span className="kbd !bg-d2 !border-dl !text-dt">{k}</span></li>)}</ul>
      </Dialog>
      <Dialog dusk open={confirmEnd} onOpenChange={setConfirmEnd} title="End the meeting for everyone?" description="Everyone is removed from the call and the minutes start writing." footer={<><button className="btn btn-ghost !bg-d2 !border-dl !text-dt" onClick={() => setConfirmEnd(false)}>Cancel</button><button className="btn btn-danger" onClick={endForAll}>End for everyone</button></>} />
    </div>
  );
}
