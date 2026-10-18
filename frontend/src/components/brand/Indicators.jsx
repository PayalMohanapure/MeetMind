import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LevelMeter({ level = 0, bars = 5, className, segments }) {
  if (segments) {
    return (
      <div className={cn('flex gap-[3px] items-center', className)} role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
        {Array.from({ length: segments }, (_, i) => {
          const on = level * segments > i;
          const c = i < segments * 0.6 ? '#7DB52D' : i < segments * 0.85 ? 'var(--sun)' : 'var(--coral)';
          return <span key={i} className="h-2.5 flex-1 rounded-full transition-colors duration-75" style={{ background: on ? c : 'var(--surface-3)' }} />;
        })}
      </div>
    );
  }
  const hs = [0.45, 0.85, 0.6, 1, 0.55].slice(0, bars);
  return (
    <span className={cn('inline-flex items-end gap-[2px] h-3', className)} aria-hidden="true">
      {hs.map((h, i) => <span key={i} className="w-[3px] rounded-full bg-sun transition-[height] duration-100" style={{ height: `${Math.max(18, Math.min(100, level * 140 * h))}%` }} />)}
    </span>
  );
}

export function TallyLight({ label = 'Recording', className }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[13px] font-semibold', className)}>
      <span className="h-2 w-2 rounded-full bg-coral animate-[pulse-halo_1.8s_ease-out_infinite]" />{label}
    </span>
  );
}

const STATUS = {
  live: { cls: 'badge-live', label: 'Live', dot: true },
  ready: { cls: 'badge-ready', label: 'Ready', icon: CheckCircle2 },
  failed: { cls: 'badge-failed', label: 'Failed', icon: AlertTriangle },
  processing: { cls: 'badge-proc', label: 'Processing', spin: true },
  scheduled: { cls: 'badge-sched', label: 'Scheduled' },
  none: { cls: 'badge-neutral', label: 'Not recorded' },
};
export function meetingBadgeKind(m) {
  if (!m) return 'none';
  if (m.status === 'live') return 'live';
  if (m.status === 'scheduled') return 'scheduled';
  if (m.processing_status === 'ready') return 'ready';
  if (m.processing_status === 'failed') return 'failed';
  if (m.processing_status && m.processing_status !== 'none') return 'processing';
  return 'none';
}
export function StatusBadge({ kind, meeting, className }) {
  const k = kind || meetingBadgeKind(meeting);
  const s = STATUS[k];
  const Icon = s.icon;
  return (
    <span className={cn('badge', s.cls, className)}>
      {s.dot && <span className="h-1.5 w-1.5 rounded-full bg-coral animate-[pulse-halo_1.8s_ease-out_infinite]" />}
      {s.spin && <Loader2 size={12} className="animate-spin" />}
      {Icon && <Icon size={12} strokeWidth={2.2} />}
      {s.label}
    </span>
  );
}

export function AiBadge({ className }) {
  return <span className={cn('badge badge-ai h-[22px] px-2 text-[11px] font-bold', className)}>AI</span>;
}
