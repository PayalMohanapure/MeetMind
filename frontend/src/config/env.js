const e = import.meta.env;
const flag = (v, d = false) => (v === undefined || v === '' ? d : String(v).toLowerCase() === 'true');

/** Demo mode (in-browser fake backend, nothing saved) is OFF unless VITE_USE_MOCK=true. */
export const USE_MOCK = flag(e.VITE_USE_MOCK, false);
/** Your FastAPI server. Every signup, login, meeting and task goes through it into PostgreSQL. */
export const API_URL = (e.VITE_API_URL || (USE_MOCK ? '' : 'http://localhost:8000')).replace(/\/$/, '');
export const API_PREFIX = e.VITE_API_PREFIX ?? '/api/v1';
export const SOCKET_URL = (e.VITE_SOCKET_URL || API_URL || '').replace(/\/$/, '');
export const SOCKET_PATH = e.VITE_SOCKET_PATH || '/socket.io';
export const REPO_URL = e.VITE_REPO_URL || '';
export const PUBLIC_APP_URL = (e.VITE_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
export const IS_TEST = e.MODE === 'test';
