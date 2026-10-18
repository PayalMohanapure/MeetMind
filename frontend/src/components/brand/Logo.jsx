import { cn } from '@/lib/utils';
export function LogoMark({ size = 28, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cn('shrink-0', className)} aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="#3150FF" />
      <rect x="6" y="6" width="6" height="6" rx="3" fill="#FFC53D" />
      <rect x="13" y="6" width="6" height="6" rx="3" fill="#fff" />
      <rect x="20" y="6" width="6" height="6" rx="3" fill="#FF8A3D" />
      <rect x="6" y="19" width="20" height="7" rx="3.5" fill="#fff" fillOpacity=".92" />
    </svg>
  );
}
export function Logo({ size = 28, className, light }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 font-display font-bold text-[20px] tracking-[-0.02em]', light ? 'text-white' : 'text-ink', className)}>
      <LogoMark size={size} />MeetMind
    </span>
  );
}
