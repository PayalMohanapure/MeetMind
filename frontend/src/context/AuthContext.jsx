import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '@/api/auth';
import { refreshSession } from '@/lib/api';
import { session } from '@/lib/session';
import { queryClient } from '@/lib/queryClient';
import { closeSocket } from '@/lib/socket';
import { USE_MOCK } from '@/config/env';

const AuthCtx = createContext(null);
let restorePromise = null;

/** Single-flight session restore on app start. */
function restore() {
  if (!restorePromise) {
    restorePromise = (async () => {
      if (USE_MOCK && !session.refreshToken) return null;
      const ok = await refreshSession();
      if (!ok) return null;
      try { return await authApi.me(); } catch { return null; }
    })();
  }
  return restorePromise;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let alive = true;
    restore().then((u) => { if (!alive) return; setUser(u); setStatus(u ? 'authed' : 'guest'); });
    const off = session.subscribe((t) => { if (!t && alive) { setUser(null); setStatus('guest'); } });
    return () => { alive = false; off(); };
  }, []);

  const finish = useCallback(async (tokens) => {
    session.set(tokens);
    const u = tokens.user ? { ...tokens.user, ...(await authApi.me().catch(() => ({}))) } : await authApi.me();
    restorePromise = Promise.resolve(u);
    setUser(u); setStatus('authed');
    return u;
  }, []);

  const value = useMemo(() => ({
    user, status, isAuthed: status === 'authed',
    login: async (identifier, password) => finish(await authApi.login(identifier, password)),
    register: async (data) => { await authApi.register(data); return finish(await authApi.login(data.username, data.password)); },
    demo: async () => finish(await authApi.demoLogin()),
    logout: async () => {
      const done = authApi.logout(); // request is built with the current token before we clear it
      session.clear(); closeSocket(); queryClient.clear();
      await done;
      restorePromise = Promise.resolve(null);
      setUser(null); setStatus('guest');
    },
    setUser,
  }), [user, status, finish]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
