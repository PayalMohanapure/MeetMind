/* Demo-mode room that speaks the same Socket.IO protocol as the real backend (no WebRTC peers). */
import { PEOPLE } from './data';

const LINES = {
  'u-asha': ["Let's lock the launch for the tenth of November.", 'Can everyone share a one-line update?', "Good, that's decided then."],
  'u-rahul': ['The release notes draft goes out on Friday.', 'Retrieval accuracy is up to 86 percent.', 'I can take the bug bash this week.'],
  'u-priya': ['Marketing needs ten days for the announcement.', "I'll check the payment gateway fees.", 'Students should get pro for free.'],
  'u-meera': ['Design review is moved to Thursday.', 'I have the new onboarding screens ready.', 'Looks good to me.'],
};

export function createMockSocket() {
  const handlers = new Map();
  let timers = [];
  let peers = [];
  let me = null;
  const fire = (ev, ...args) => (handlers.get(ev) || []).forEach((h) => h(...args));
  const later = (ms, fn) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const every = (ms, fn) => { const t = setInterval(fn, ms); timers.push(t); return t; };
  const participants = () => [{ sid: me.sid, userId: me.userId, fullName: me.fullName }, ...peers.map((p) => ({ sid: p.sid, userId: p.userId, fullName: p.fullName }))];
  const clear = () => { timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = []; };

  const socket = {
    connected: true,
    id: 'me-sid',
    on(ev, h) { if (!handlers.has(ev)) handlers.set(ev, []); handlers.get(ev).push(h); return socket; },
    off(ev, h) { if (!h) handlers.delete(ev); else handlers.set(ev, (handlers.get(ev) || []).filter((x) => x !== h)); return socket; },
    removeAllListeners() { handlers.clear(); },
    emit(ev, ...args) {
      if (ev === 'join-call') {
        const code = args[0];
        me = { sid: 'me-sid', userId: 'me', fullName: 'You' };
        const seeded = code === 'abc-defg-hij';
        peers = (seeded ? ['asha', 'rahul', 'priya', 'meera'] : []).map((k) => ({ sid: `sid-${k}`, userId: PEOPLE[k].id, fullName: PEOPLE[k].full_name }));
        later(200, () => {
          fire('user-joined', me.sid, participants().map((p) => p.sid));
          fire('participants', participants());
          peers.forEach((p, i) => fire('signal', p.sid, { type: 'state', mic: i !== 1, cam: false, hand: false }));
          if (seeded) {
            fire('chat-message', 'Sharing the pricing doc in a minute', 'Priya Nair', 'sid-priya');
            fire('chat-message', 'Got it, thanks', 'Rahul Deshmukh', 'sid-rahul');
          }
        });
        if (!seeded) {
          ['asha', 'rahul'].forEach((k, i) => later(2500 + i * 2500, () => {
            const p = { sid: `sid-${k}`, userId: PEOPLE[k].id, fullName: PEOPLE[k].full_name };
            peers.push(p);
            fire('user-joined', p.sid, participants().map((x) => x.sid));
            fire('participants', participants());
          }));
        }
        let turn = 0;
        every(3200, () => {
          const talkers = peers.filter((_, i) => i !== 1);
          if (!talkers.length) return;
          const p = talkers[turn % talkers.length]; turn++;
          fire('peer_speaking', { sid: p.sid, speaking: true });
          later(2600, () => fire('peer_speaking', { sid: p.sid, speaking: false }));
          const lines = LINES[p.userId] || ['Sounds good.'];
          fire('caption', { sid: p.sid, user_id: p.userId, display_name: p.fullName, text: lines[turn % lines.length], final: true });
        });
      } else if (ev === 'chat-message') {
        const text = args[0];
        fire('chat-message', text, me?.fullName || 'You', me?.sid);
        if (peers.length && /\?$/.test(String(text).trim())) later(1800, () => fire('chat-message', 'Good question, let me check.', peers[0].fullName, peers[0].sid));
      } else if (ev === 'signal') {
        const [, msg] = args;
        if (msg?.type === 'state' && msg.hand && peers[0]) later(3000, () => fire('chat-message', 'Go ahead, you have the floor.', peers[0].fullName, peers[0].sid));
      } else if (ev === 'leave-call') {
        clear(); peers = [];
      }
      return socket;
    },
    disconnect() { clear(); socket.connected = false; },
    connect() { socket.connected = true; },
  };
  return socket;
}
