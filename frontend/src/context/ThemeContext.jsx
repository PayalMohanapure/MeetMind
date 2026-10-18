import { createContext, useContext, useEffect, useState } from 'react';
import { storage } from '@/lib/utils';

const ThemeCtx = createContext(null);
const apply = (pref) => {
  const night = pref === 'night' || (pref === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  if (night) document.documentElement.dataset.theme = 'night';
  else delete document.documentElement.dataset.theme;
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => storage.get('mm-theme', 'daylight'));
  useEffect(() => {
    apply(theme); storage.set('mm-theme', theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const f = () => apply('system');
    mq.addEventListener?.('change', f);
    return () => mq.removeEventListener?.('change', f);
  }, [theme]);
  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);

/** Public pages are always Daylight; the stored preference applies inside /app. */
export function useForceDaylight(active = true) {
  useEffect(() => {
    if (!active) return;
    const prev = document.documentElement.dataset.theme;
    delete document.documentElement.dataset.theme;
    return () => { if (prev) document.documentElement.dataset.theme = prev; };
  }, [active]);
}
