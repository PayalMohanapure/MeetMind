import { storage } from './utils';

/** Access token lives only in memory. A refresh token (if your backend returns one in the body) is kept in localStorage. */
let accessToken = null;
const listeners = new Set();
const RT_KEY = 'mm-rt';

export const session = {
  get token() { return accessToken; },
  set(tokens) {
    accessToken = tokens?.access_token || null;
    if (tokens?.refresh_token) storage.set(RT_KEY, tokens.refresh_token);
    listeners.forEach((l) => l(accessToken));
  },
  clear() { accessToken = null; storage.remove(RT_KEY); listeners.forEach((l) => l(null)); },
  get refreshToken() { return storage.get(RT_KEY); },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
