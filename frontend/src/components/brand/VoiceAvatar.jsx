import { voiceColor, voiceText } from '@/lib/voiceColor';
import { cn, initials } from '@/lib/utils';

export function VoiceAvatar({ id, name, size = 30, speaking, className, ring = true, title, decorative }) {
  return (
    <span
      title={title ?? name}
      aria-hidden={decorative || undefined}
      className={cn('inline-grid place-items-center shrink-0 font-display font-bold select-none transition-shadow', speaking && 'ring-speaking', className)}
      style={{ width: size, height: size, borderRadius: size * 0.3, background: voiceColor(id ?? name), color: voiceText(id ?? name), fontSize: Math.max(10, size * 0.38), boxShadow: ring && !speaking ? '0 0 0 2px var(--surface)' : undefined }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people = [], max = 4, size = 24 }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="inline-flex items-center" aria-label={people.map((p) => p.full_name).join(', ')}>
      {shown.map((p, i) => <VoiceAvatar key={p.user_id || i} id={p.user_id} name={p.full_name} size={size} className={i ? '-ml-1.5' : ''} />)}
      {extra > 0 && <span className="-ml-1.5 inline-grid place-items-center rounded-[8px] bg-surface-3 text-ink-2 text-[11px] font-bold shadow-[0_0_0_2px_var(--surface)]" style={{ width: size, height: size }}>+{extra}</span>}
    </span>
  );
}
