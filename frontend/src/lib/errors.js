export class ApiError extends Error {
  constructor(status, detail, data) {
    super(typeof detail === 'string' ? detail : 'Request failed');
    this.status = status;
    this.detail = detail;
    this.data = data;
  }
}

/** Turn any error (FastAPI detail string, 422 validation array, network) into one readable sentence. */
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  if (err.name === 'TypeError' || err.status === 0) return "Can't reach the server. Check your connection and try again.";
  const d = err.detail ?? err.message;
  if (Array.isArray(d)) return d.map((x) => x.msg?.replace(/^Value error, /, '') || String(x)).join(' ');
  if (typeof d === 'string' && d) return d;
  if (err.status === 429) return "You're sending requests too fast. Wait a moment and try again.";
  if (err.status >= 500) return 'The server had a problem. Try again in a moment.';
  return fallback;
}
