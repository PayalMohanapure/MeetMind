import { voiceColor } from '@/lib/voiceColor';
/** 8px stacked bar of talk share per speaker. */
export function MiniVoiceprint({ shares = [], className = '' }) {
  const total = shares.reduce((a, s) => a + s.value, 0) || 1;
  if (!shares.length) return <span className={`block h-2 rounded-full bg-surface-3 ${className}`} />;
  return (
    <span className={`flex h-2 gap-[2px] overflow-hidden rounded-full ${className}`} role="img" aria-label={`Talk share: ${shares.map((s) => `${s.name} ${Math.round((s.value / total) * 100)}%`).join(', ')}`}>
      {shares.map((s) => <span key={s.id} style={{ width: `${(s.value / total) * 100}%`, background: voiceColor(s.id) }} className="h-full first:rounded-l-full last:rounded-r-full" />)}
    </span>
  );
}
