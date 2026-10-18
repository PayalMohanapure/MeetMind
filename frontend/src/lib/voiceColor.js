export const VOICES = [
  // color: fills (tiles, lanes, avatars) · ink: names on light surfaces (≥ 4.5:1) · text: initials on the fill (≥ 4.5:1)
  { key: 1, color: '#3F5EF0', ink: 'var(--voice-1-ink)', text: '#FFFFFF' },
  { key: 2, color: '#FF8A3D', ink: 'var(--voice-2-ink)', text: '#1A2042' },
  { key: 3, color: '#CC3D88', ink: 'var(--voice-3-ink)', text: '#FFFFFF' },
  { key: 4, color: '#1EA7E1', ink: 'var(--voice-4-ink)', text: '#1A2042' },
  { key: 5, color: '#7DB52D', ink: 'var(--voice-5-ink)', text: '#1A2042' },
  { key: 6, color: '#0FA39A', ink: 'var(--voice-6-ink)', text: '#1A2042' },
];

/** Stable FNV-1a hash of a user id → one of six voice colours. */
export function voiceIndex(id) {
  const s = String(id ?? '');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) % VOICES.length;
}
export const voiceOf = (id) => VOICES[voiceIndex(id)];
export const voiceColor = (id) => voiceOf(id).color;
export const voiceInk = (id) => voiceOf(id).ink;
export const voiceText = (id) => voiceOf(id).text;
