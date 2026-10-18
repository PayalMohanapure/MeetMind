import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { getIceServers } from '@/api/meetings';

const FALLBACK_ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];

/**
 * One meeting room over the MeetMind Socket.IO server + mesh WebRTC (≤ 6 people).
 * Protocol (backend app/realtime/socket_server.py):
 *   join-call(code) → user-joined(sid, allSids) + participants([{sid,userId,fullName}])
 *   signal(toSid, msg) ↔ signal(fromSid, msg)   chat-message(text) ↔ chat-message(text, name, sid)
 *   user-left(sid)  meeting-ended({meetingCode})  call-error({detail})
 * The newcomer sends an offer to everyone already in the room; others answer.
 * Mic/camera/hand state and reactions travel peer-to-peer inside `signal` messages.
 */
export function useRoom({ code, user, localStream, mic, cam, hand, enabled = true }) {
  const [peers, setPeers] = useState({}); // sid -> { sid, user_id, display_name, mic, cam, hand, screen, stream, speaking, quality }
  const [messages, setMessages] = useState([]);
  const [caption, setCaption] = useState(null);
  const [connection, setConnection] = useState('connecting'); // connecting | ok | unstable | lost
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState(null);
  const [reactions, setReactions] = useState([]);
  const [mySid, setMySid] = useState(null);
  const sock = useRef(null);
  const pcs = useRef(new Map());
  const pendingIce = useRef(new Map());
  const ice = useRef(FALLBACK_ICE);
  const local = useRef(localStream);
  const screen = useRef(null);
  const me = useRef({ mic, cam, hand });
  local.current = localStream;
  me.current = { mic, cam, hand };

  const upd = (sid, patch) => setPeers((p) => ({ ...p, [sid]: { sid, mic: true, cam: true, ...(p[sid] || {}), ...patch } }));
  const remove = (sid) => setPeers((p) => { const c = { ...p }; delete c[sid]; return c; });
  const sendTo = (sid, msg) => sock.current?.emit('signal', sid, msg);
  const myState = () => ({ type: 'state', mic: me.current.mic, cam: me.current.cam, hand: me.current.hand, screen: !!screen.current });
  const broadcast = (msg) => pcs.current.forEach((_, sid) => sendTo(sid, msg));

  const addLocalTracks = (pc) => {
    const st = local.current;
    st?.getTracks().forEach((t) => pc.addTrack(t, st));
    if (!st?.getAudioTracks().length) pc.addTransceiver('audio', { direction: 'recvonly' });
    if (!st?.getVideoTracks().length) pc.addTransceiver('video', { direction: 'recvonly' });
    if (screen.current) pc.getSenders().find((s) => s.track?.kind === 'video')?.replaceTrack(screen.current.getVideoTracks()[0]);
  };

  const makePc = useCallback((sid) => {
    if (pcs.current.has(sid)) return pcs.current.get(sid);
    const pc = new RTCPeerConnection({ iceServers: ice.current });
    addLocalTracks(pc);
    pc.onicecandidate = (e) => { if (e.candidate) sendTo(sid, { type: 'ice', candidate: e.candidate.toJSON() }); };
    pc.ontrack = (e) => upd(sid, { stream: e.streams[0] || new MediaStream([e.track]) });
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      upd(sid, { quality: s === 'connected' ? 'good' : s === 'disconnected' || s === 'failed' ? 'poor' : s });
      if (s === 'connected') sendTo(sid, myState());
      if (s === 'failed') pc.restartIce?.();
    };
    pcs.current.set(sid, pc);
    return pc;
  }, []);

  const closePc = (sid) => { pcs.current.get(sid)?.close(); pcs.current.delete(sid); pendingIce.current.delete(sid); };

  const flushIce = async (sid) => {
    const pc = pcs.current.get(sid);
    const list = pendingIce.current.get(sid) || [];
    pendingIce.current.delete(sid);
    for (const c of list) await pc?.addIceCandidate(c).catch(() => {});
  };

  useEffect(() => {
    if (!enabled || !code) return;
    let alive = true;
    let s;
    const conns = pcs.current;
    const handlers = {};
    const on = (ev, fn) => { handlers[ev] = fn; s.on(ev, fn); };
    (async () => {
      try { const r = await getIceServers(); const list = r?.iceServers || r?.ice_servers; if (list?.length) ice.current = list; } catch { /* fallback STUN */ }
      s = await getSocket();
      if (!alive) return;
      sock.current = s;
      const join = () => { setMySid(s.id); s.emit('join-call', code); };

      on('connect', () => { setConnection('ok'); join(); });
      on('disconnect', () => setConnection('lost'));
      on('connect_error', (e) => { setConnection('unstable'); if (/auth|token|expired/i.test(e?.message || '')) setError('Your session expired. Reload the page to rejoin.'); });

      on('user-joined', async (sid, allSids = []) => {
        setConnection('ok');
        if (sid === s.id) {
          // I just joined: call everyone already here.
          for (const other of allSids) {
            if (other === s.id || pcs.current.has(other)) continue;
            upd(other, {});
            const pc = makePc(other);
            try { await pc.setLocalDescription(await pc.createOffer()); sendTo(other, { type: 'offer', sdp: pc.localDescription.toJSON() }); } catch (e) { console.warn('offer failed', e); }
          }
        } else {
          upd(sid, {}); // they will send me an offer
        }
      });
      on('participants', (list = []) => {
        setPeers((p) => {
          const next = {};
          for (const x of list) {
            if (x.sid === s.id) continue;
            next[x.sid] = { sid: x.sid, mic: true, cam: true, ...(p[x.sid] || {}), user_id: x.userId, display_name: x.fullName };
          }
          Object.keys(p).forEach((sid) => { if (!next[sid]) closePc(sid); });
          return next;
        });
      });
      on('signal', async (from, msg) => {
        if (!msg || typeof msg !== 'object') return;
        try {
          if (msg.type === 'offer') {
            const pc = makePc(from);
            await pc.setRemoteDescription(msg.sdp);
            await flushIce(from);
            await pc.setLocalDescription(await pc.createAnswer());
            sendTo(from, { type: 'answer', sdp: pc.localDescription.toJSON() });
          } else if (msg.type === 'answer') {
            await pcs.current.get(from)?.setRemoteDescription(msg.sdp);
            await flushIce(from);
          } else if (msg.type === 'ice') {
            const pc = pcs.current.get(from);
            if (pc?.remoteDescription) await pc.addIceCandidate(msg.candidate).catch(() => {});
            else pendingIce.current.set(from, [...(pendingIce.current.get(from) || []), msg.candidate]);
          } else if (msg.type === 'state') {
            upd(from, { mic: msg.mic !== false, cam: msg.cam !== false, hand: !!msg.hand, screen: !!msg.screen });
          } else if (msg.type === 'reaction') {
            const id = Math.random();
            setReactions((r) => [...r, { id, sid: from, emoji: msg.emoji }]);
            setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 3200);
          }
        } catch (e) { console.warn('signal error', e); }
      });
      on('chat-message', (text, senderName, senderSid) => {
        const self = senderSid ? senderSid === s.id : senderName === user?.full_name;
        setMessages((ms) => [...ms, { id: `${Date.now()}-${Math.random()}`, text, display_name: senderName, sid: senderSid, self, sent_at: new Date().toISOString(), history: !senderSid }]);
      });
      on('user-left', (sid) => { closePc(sid); remove(sid); });
      on('meeting-ended', () => setEnded(true));
      on('call-error', (e) => setError(e?.detail || 'Could not join the call.'));
      // demo-mode extras (the real server never sends these)
      on('peer_speaking', ({ sid, speaking }) => upd(sid, { speaking }));
      on('caption', (c) => setCaption({ ...c, at: Date.now() }));

      if (s.connected) { setConnection('ok'); join(); }
    })();
    return () => {
      alive = false;
      if (s) {
        s.emit('leave-call');
        Object.entries(handlers).forEach(([ev, fn]) => s.off(ev, fn));
      }
      conns.forEach((pc) => pc.close()); conns.clear();
    };
  }, [code, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Late local stream (e.g. after a reload): add tracks to existing connections.
  useEffect(() => {
    if (!localStream) return;
    pcs.current.forEach((pc) => {
      localStream.getTracks().forEach((t) => {
        const sender = pc.getSenders().find((x) => x.track?.kind === t.kind || (!x.track && x.dtmf === null));
        if (sender && !sender.track) sender.replaceTrack(t).catch(() => {});
      });
    });
  }, [localStream]);

  useEffect(() => { broadcast(myState()); }, [mic, cam, hand]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = (text) => sock.current?.emit('chat-message', text);
  const raiseHand = () => broadcast(myState());
  const react = (emoji) => {
    broadcast({ type: 'reaction', emoji });
    const id = Math.random();
    setReactions((r) => [...r, { id, sid: 'me', emoji }]);
    setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 3200);
  };
  /** Swap the outgoing video track for a screen share (or back). */
  const setScreen = (stream) => {
    screen.current = stream;
    const track = stream ? stream.getVideoTracks()[0] : local.current?.getVideoTracks()[0];
    pcs.current.forEach((pc) => pc.getSenders().filter((x) => x.track?.kind === 'video').forEach((x) => x.replaceTrack(track || null).catch(() => {})));
    broadcast(myState());
  };

  return { peers: Object.values(peers), messages, send, caption, connection, ended, error, raiseHand, react, reactions, setScreen, mySid };
}
