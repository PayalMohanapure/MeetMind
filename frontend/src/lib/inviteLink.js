import { PUBLIC_APP_URL } from '@/config/env';

const CODE_RE = /^[a-z0-9]{3,4}-[a-z0-9]{3,4}-[a-z0-9]{3,4}$|^[a-z0-9-]{4,40}$/i;

export const inviteUrl = (code) => `${PUBLIC_APP_URL}/app/meet/${code}/lobby`;
export const shortInvite = (code) => inviteUrl(code).replace(/^https?:\/\//, '');

/** Accepts "abc-defg-hij", "meetmind.app/abc-defg-hij" or a full invite URL and returns the code. */
export function parseMeetingCode(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  let s = raw;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (u.pathname && u.pathname !== '/') {
      const parts = u.pathname.split('/').filter(Boolean);
      const i = parts.indexOf('meet');
      s = i >= 0 && parts[i + 1] ? parts[i + 1] : parts[parts.length - 1];
    }
  } catch { /* not a URL */ }
  s = s.replace(/[?#].*$/, '').toLowerCase();
  return CODE_RE.test(s) ? s : null;
}
