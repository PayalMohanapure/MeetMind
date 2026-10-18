import { API_URL, API_PREFIX, USE_MOCK } from '@/config/env';
import { AUTH } from '@/api/endpoints';
import { ApiError } from './errors';
import { session } from './session';
import { normTokens } from '@/api/normalize';

let mockHandle = null;
async function mock() {
  if (!mockHandle) mockHandle = (await import('@/mock/server')).handle;
  return mockHandle;
}

const url = (path, query) => {
  const u = `${API_URL}${API_PREFIX}${path}`;
  if (!query) return u;
  const q = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v); });
  const s = q.toString();
  return s ? `${u}?${s}` : u;
};

let refreshing = null;
/** Single-flight token refresh. Resolves true when a new access token is set. */
export function refreshSession() {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const rt = session.refreshToken;
        const data = await raw('POST', AUTH.refresh, { body: rt ? { refresh_token: rt } : undefined, skipAuth: true, noRetry: true });
        const t = normTokens(data);
        if (!t?.access_token) return false;
        session.set(t);
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => { refreshing = null; }, 0);
      }
    })();
  }
  return refreshing;
}

async function raw(method, path, { body, query, form, skipAuth, noRetry, signal, headers: extra } = {}) {
  if (USE_MOCK) {
    const handle = await mock();
    return handle(method, path, { body, query, form, token: session.token });
  }
  const headers = { Accept: 'application/json', ...extra };
  let payload;
  if (form instanceof FormData) payload = form;
  else if (form) { payload = new URLSearchParams(form); headers['Content-Type'] = 'application/x-www-form-urlencoded'; }
  else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  if (!skipAuth && session.token) headers.Authorization = `Bearer ${session.token}`;

  let res;
  try {
    res = await fetch(url(path, query), { method, headers, body: payload, credentials: 'include', signal });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  if (res.status === 401 && !noRetry && !skipAuth) {
    if (await refreshSession()) return raw(method, path, { body, query, form, signal, headers: extra, noRetry: true });
    session.clear();
  }
  if (res.status === 204) return null;
  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json().catch(() => null) : await res.text();
  if (!res.ok) throw new ApiError(res.status, data?.detail ?? data?.message ?? res.statusText, data);
  return data;
}

export const api = {
  get: (p, o) => raw('GET', p, o),
  post: (p, body, o) => raw('POST', p, { ...o, body }),
  patch: (p, body, o) => raw('PATCH', p, { ...o, body }),
  put: (p, body, o) => raw('PUT', p, { ...o, body }),
  del: (p, o) => raw('DELETE', p, o),
  raw,
  url,
};
