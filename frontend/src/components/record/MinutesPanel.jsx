import { CheckCircle2, HelpCircle, ListChecks, BookOpen } from 'lucide-react';
import { Link } from 'react-router';
import { Checkbox } from '@/components/ui/Checkbox';
import { AiBadge } from '@/components/brand/Indicators';
import { clock, dayMonth } from '@/lib/format';
import { cn } from '@/lib/utils';

function At({ sec, onSeek }) {
  if (sec === null || sec === undefined) return null;
  return <button onClick={() => onSeek?.(sec)} className="text-[12.5px] font-semibold text-cobalt hover:underline underline-offset-2 tabnum">at {clock(sec)}</button>;
}
function Section({ icon: Icon, title, count, children }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-[13px] font-bold text-iris-ink mb-2.5"><Icon size={15} />{title}{count !== undefined && <span className="text-iris-ink/60 tabnum">{count}</span>}</h3>
      {children}
    </section>
  );
}

/** Decisions, open questions, tasks and chapters — everything AI-written gets the iris treatment. */
export function MinutesPanel({ summary, tasks = [], onSeek, onToggleTask, demo }) {
  const decisions = summary?.decisions || [];
  const questions = summary?.open_questions || [];
  const chapters = summary?.chapters || [];
  const keyPoints = summary?.key_points || [];
  return (
    <aside className="rounded-[24px] p-5 md:p-6 border border-iris-soft space-y-6" style={{ background: 'var(--iris-panel)' }} aria-label="Minutes">
      <div className="flex items-center gap-2"><AiBadge /><h2 className="font-display text-[18px] font-bold tracking-[-0.015em]">Minutes</h2></div>
      <Section icon={CheckCircle2} title="Decisions" count={decisions.length}>
        <ol className="space-y-2">
          {decisions.map((d, i) => (
            <li key={i} className="flex gap-3 rounded-[14px] bg-surface p-3.5 shadow-[0_1px_2px_rgba(26,32,66,.05)]">
              <span className="h-6 w-6 rounded-[8px] bg-iris text-white grid place-items-center text-[12px] font-bold shrink-0 tabnum">{i + 1}</span>
              <div className="min-w-0"><p className="font-record text-[16px] leading-snug">{d.text}</p><At sec={d.start} onSeek={onSeek} /></div>
            </li>
          ))}
          {!decisions.length && <p className="text-[14px] text-ink-2">No decisions were recorded.</p>}
        </ol>
      </Section>
      {!!keyPoints.length && (
        <Section icon={BookOpen} title="Key points" count={keyPoints.length}>
          <ul className="space-y-2">
            {keyPoints.map((k, i) => <li key={i} className="flex gap-2.5 rounded-[14px] bg-surface p-3.5"><span className="mt-[9px] h-1.5 w-1.5 rounded-full bg-iris shrink-0" /><p className="font-record text-[16px] leading-snug">{k.text}</p></li>)}
          </ul>
        </Section>
      )}
      {!!questions.length && (
        <Section icon={HelpCircle} title="Open questions" count={questions.length}>
          <ul className="space-y-2">
            {questions.map((q, i) => <li key={i} className="rounded-[14px] border border-dashed border-iris/35 p-3.5"><p className="font-record text-[16px] leading-snug">{q.text}</p><At sec={q.start} onSeek={onSeek} /></li>)}
          </ul>
        </Section>
      )}
      <Section icon={ListChecks} title="Tasks" count={tasks.length}>
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="flex gap-3 rounded-[14px] bg-surface p-3.5 shadow-[0_1px_2px_rgba(26,32,66,.05)]">
              <Checkbox checked={t.status === 'done'} onCheckedChange={(v) => onToggleTask?.(t, v)} aria-label={`Mark "${t.title}" ${t.status === 'done' ? 'not done' : 'done'}`} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className={cn('font-semibold text-[14.5px]', t.status === 'done' && 'line-through text-ink-3')}>{t.title}</p>
                <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-ink-2 mt-0.5">
                  <span>{t.assignee_name}</span>
                  {t.due_date && <span>Due {dayMonth(t.due_date)}</span>}
                  {t.heard_at !== null && t.heard_at !== undefined && <button onClick={() => onSeek?.(t.heard_at)} className="font-semibold text-cobalt hover:underline underline-offset-2">Heard at {clock(t.heard_at)}</button>}
                </p>
              </div>
            </li>
          ))}
          {!tasks.length && <p className="text-[14px] text-ink-2">No tasks came out of this meeting.</p>}
        </ul>
        {!demo && !!tasks.length && <Link to="/app/action-items" className="inline-block mt-3 text-[13px] link">Open all tasks</Link>}
      </Section>
      {!!chapters.length && (
        <Section icon={BookOpen} title="Chapters" count={chapters.length}>
          <ol className="grid gap-1">
            {chapters.map((c, i) => (
              <li key={i}><button onClick={() => onSeek?.(c.start)} className="w-full flex items-center gap-3 rounded-[10px] px-2 py-1.5 text-left hover:bg-surface/70"><span className="text-[12.5px] text-ink-3 tabnum w-11">{clock(c.start)}</span><span className="text-[14px] font-semibold">{c.title}</span></button></li>
            ))}
          </ol>
        </Section>
      )}
    </aside>
  );
}
