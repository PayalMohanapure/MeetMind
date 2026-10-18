/** Hand-off between the lobby and the room within one tab (the stream can't go through the URL). */
export const roomSession = {
  code: null,
  stream: null,
  mic: true,
  cam: true,
  passed: new Set(),
  enter(code, { stream, mic, cam }) { this.code = code; this.stream = stream; this.mic = mic; this.cam = cam; this.passed.add(code); try { sessionStorage.setItem(`mm-lobby-${code}`, '1'); } catch { /* */ } },
  hasPassed(code) { if (this.passed.has(code)) return true; try { return sessionStorage.getItem(`mm-lobby-${code}`) === '1'; } catch { return false; } },
  take(code) { if (this.code !== code) return null; const s = this.stream; this.stream = null; return s; },
};
