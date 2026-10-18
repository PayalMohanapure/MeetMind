import { Check, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  ['waiting_uploads', 'Waiting for uploads'],
  ['transcribing', 'Transcribing'],
  ['embedding', 'Building memory'],
  ['summarizing', 'Writing minutes'],
];
export function ProcessingStepper({ status, error, onRetry, canRetry, dark }) {
  const idx = status === 'ready' ? STEPS.length : STEPS.findIndex(([k]) => k === status);
  if (status === 'failed') {
    return (
      <div role="alert" className="flex items-start gap-3">
        <AlertTriangle size={20} className="text-coral shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">The minutes couldn't be written.</p>
          <p className={cn('text-[14px] mt-1', dark ? 'text-white/75' : 'text-ink-2')}>{error || 'Something failed while processing the recording.'} {canRetry ? 'Run it again to retry.' : 'The host can run it again.'}</p>
          {canRetry && <button onClick={onRetry} className={cn('btn btn-sm mt-3', dark ? 'btn-white' : 'btn-primary')}>Run again</button>}
        </div>
      </div>
    );
  }
  return (
    <ol className="grid gap-3 sm:grid-cols-4" aria-label="Processing progress">
      {STEPS.map(([k, label], i) => {
        const done = i < idx, cur = i === idx;
        return (
          <li key={k} className="flex items-center gap-2.5" aria-current={cur ? 'step' : undefined}>
            <span className={cn('h-7 w-7 rounded-full grid place-items-center shrink-0 transition-colors', done ? 'bg-ok text-white' : cur ? (dark ? 'bg-white text-cobalt' : 'bg-cobalt text-white') : dark ? 'bg-white/15 text-white/60' : 'bg-surface-3 text-ink-3')}>
              {done ? <Check size={15} strokeWidth={3} /> : cur ? <Loader2 size={15} className="animate-spin" /> : <span className="text-[12px] font-bold">{i + 1}</span>}
            </span>
            <span className={cn('text-[14px] font-semibold', !done && !cur && (dark ? 'text-white/60' : 'text-ink-3'))}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
