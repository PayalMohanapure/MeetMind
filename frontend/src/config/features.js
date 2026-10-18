const e = import.meta.env;
const flag = (v, d) => (v === undefined || v === '' ? d : String(v).toLowerCase() === 'true');
const mock = flag(e.VITE_USE_MOCK, false);

// Defaults match the MeetMind FastAPI backend (app/api/v1, app/realtime/socket_server.py).
export const features = {
  demo: flag(e.VITE_FEATURE_DEMO, mock),            // backend has no /auth/demo
  account: flag(e.VITE_FEATURE_ACCOUNT, false),
  captions: flag(e.VITE_FEATURE_CAPTIONS, mock),    // backend sends no live captions
  raiseHand: flag(e.VITE_FEATURE_RAISE_HAND, true), // sent peer-to-peer over the signal channel
  reactions: flag(e.VITE_FEATURE_REACTIONS, true),  // sent peer-to-peer over the signal channel
  knock: flag(e.VITE_FEATURE_KNOCK, false),
  usage: flag(e.VITE_FEATURE_USAGE, false),
  bgBlur: flag(e.VITE_FEATURE_BG_BLUR, false),
  schedule: flag(e.VITE_FEATURE_SCHEDULE, mock),    // backend has no scheduled_for field
};
