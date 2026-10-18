import { voiceColor, voiceInk } from '@/lib/voiceColor';
/** Derive speakers with talk time from transcript segments. */
export function speakersFrom(segments = []) {
  const map = new Map();
  segments.forEach((s) => {
    const k = s.speaker_id || s.speaker_name;
    const cur = map.get(k) || { id: k, name: s.speaker_name, seconds: 0, color: voiceColor(k), ink: voiceInk(k) };
    cur.seconds += Math.max(1, (s.end ?? s.start + 10) - s.start);
    map.set(k, cur);
  });
  const total = [...map.values()].reduce((a, b) => a + b.seconds, 0) || 1;
  return [...map.values()].map((s) => ({ ...s, share: s.seconds / total })).sort((a, b) => b.seconds - a.seconds);
}
export const firstWord = (n = '') => n.split(' ')[0];
