import { Link } from 'react-router';
import { AlertCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/Checkbox';
import { useUpdateTask } from '@/hooks/queries';
import { clock, dayMonth, toDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { isBefore, startOfToday } from 'date-fns';

export const isOverdue = (t) => t.status !== 'done' && t.due_date && isBefore(toDate(t.due_date), startOfToday());

export function TaskRow({ t, compact }) {
  const upd = useUpdateTask();
  const done = t.status === 'done';
  const overdue = isOverdue(t);
  return (
    <li className="flex gap-3.5 py-3.5 border-b border-line last:border-b-0">
      <Checkbox checked={done} onCheckedChange={(v) => upd.mutate({ id: t.id, status: v ? 'done' : 'open' })} aria-label={`Mark "${t.title}" ${done ? 'not done' : 'done'}`} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className={cn('font-semibold text-[15px]', done && 'line-through text-ink-3')}>{t.title}</p>
        <p className="flex flex-wrap gap-x-3.5 gap-y-0.5 text-[13px] text-ink-2 mt-0.5">
          {overdue ? <span className="text-coral-ink font-semibold inline-flex items-center gap-1"><AlertCircle size={13} />Overdue, {dayMonth(t.due_date)}</span> : t.due_date ? <span>Due {dayMonth(t.due_date)}</span> : !compact && <span>No date</span>}
          {t.meeting_title && <span className="truncate">{t.meeting_title}</span>}
          {t.heard_at !== null && t.heard_at !== undefined && t.meeting_code && <Link to={`/app/meetings/${t.meeting_code}?t=${t.heard_at}`} className="font-semibold text-cobalt hover:underline underline-offset-2">Heard at {clock(t.heard_at)}</Link>}
        </p>
      </div>
    </li>
  );
}
