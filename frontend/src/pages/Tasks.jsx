import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Plus, ChevronDown, Trash2, Pencil, AlertCircle, Sparkles, Bot, User } from 'lucide-react';
import { isToday, isThisWeek, isBefore, startOfToday } from 'date-fns';
import { useActionItems, useUpdateTask, useCreateTask, useDeleteTask } from '@/hooks/queries';
import { useAuth } from '@/context/AuthContext';
import { Checkbox } from '@/components/ui/Checkbox';
import { Segmented } from '@/components/ui/Segmented';
import { Switch } from '@/components/ui/Switch';
import { SkeletonRows, ErrorState, EmptyState } from '@/components/common/States';
import { clock, dayMonth, toDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const GROUPS = ['Overdue', 'Today', 'This week', 'Later', 'No date'];
function groupOf(t) {
  if (!t.due_date) return 'No date';
  const d = toDate(t.due_date);
  if (isBefore(d, startOfToday())) return 'Overdue';
  if (isToday(d)) return 'Today';
  if (isThisWeek(d, { weekStartsOn: 1 })) return 'This week';
  return 'Later';
}
const SRC = { ai: [Sparkles, 'From the minutes'], assistant: [Bot, 'From the assistant'], user: [User, 'Added by you'] };

function Row({ t }) {
  const upd = useUpdateTask();
  const del = useDeleteTask();
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(t.title);
  const [due, setDue] = useState(t.due_date || '');
  const done = t.status === 'done';
  const overdue = !done && groupOf(t) === 'Overdue';
  const [Icon, srcLabel] = SRC[t.source] || SRC.user;
  const save = () => { setEdit(false); if (title.trim() && (title !== t.title || due !== (t.due_date || ''))) upd.mutate({ id: t.id, title: title.trim(), due_date: due || null }); };
  return (
    <li className="group flex gap-3.5 py-3.5 px-3 -mx-3 rounded-[14px] hover:bg-surface-2 border-b border-line last:border-b-0">
      <Checkbox checked={done} onCheckedChange={(v) => upd.mutate({ id: t.id, status: v ? 'done' : 'open' })} aria-label={`Mark "${t.title}" ${done ? 'not done' : 'done'}`} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        {edit ? (
          <div className="flex flex-wrap gap-2">
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEdit(false); setTitle(t.title); } }} className="input h-9 flex-1 min-w-[200px] text-[14px]" aria-label="Task title" />
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="input h-9 w-auto text-[14px]" aria-label="Due date" />
            <button onClick={save} className="btn btn-primary btn-sm h-9">Save</button>
          </div>
        ) : (
          <button onClick={() => setEdit(true)} className={cn('text-left font-semibold text-[15px] hover:underline decoration-line-strong underline-offset-4', done && 'line-through text-ink-3')}>{t.title}</button>
        )}
        <p className="flex flex-wrap items-center gap-x-3.5 gap-y-0.5 text-[13px] text-ink-2 mt-0.5">
          {overdue ? <span className="text-coral-ink font-semibold inline-flex items-center gap-1"><AlertCircle size={13} />Overdue, {dayMonth(t.due_date)}</span> : t.due_date && <span>Due {dayMonth(t.due_date)}</span>}
          <span>{t.assignee_name}</span>
          {t.meeting_title && <Link to={`/app/meetings/${t.meeting_code}`} className="hover:text-ink">{t.meeting_title}</Link>}
          {t.heard_at !== null && t.heard_at !== undefined && t.meeting_code && <Link to={`/app/meetings/${t.meeting_code}?t=${t.heard_at}`} className="font-semibold text-cobalt hover:underline underline-offset-2">Heard at {clock(t.heard_at)}</Link>}
          <span className="inline-flex items-center gap-1 text-ink-3" title={srcLabel}><Icon size={12} /><span className="sr-only">{srcLabel}</span></span>
        </p>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button onClick={() => setEdit(true)} className="h-8 w-8 rounded-[9px] grid place-items-center text-ink-3 hover:bg-surface hover:text-ink" aria-label={`Edit ${t.title}`}><Pencil size={14} /></button>
        <button onClick={() => del.mutate(t.id)} className="h-8 w-8 rounded-[9px] grid place-items-center text-ink-3 hover:bg-surface hover:text-coral" aria-label={`Delete ${t.title}`}><Trash2 size={14} /></button>
      </div>
    </li>
  );
}

export default function Tasks() {
  const { user } = useAuth();
  const q = useActionItems();
  const create = useCreateTask();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [status, setStatus] = useState('open');
  const [source, setSource] = useState('all');
  const [meeting, setMeeting] = useState('');
  const [mine, setMine] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const all = useMemo(() => q.data || [], [q.data]);
  const meetings = [...new Map(all.filter((t) => t.meeting_code).map((t) => [t.meeting_code, t.meeting_title])).entries()];
  const filtered = useMemo(() => all.filter((t) => (source === 'all' || t.source === source) && (!meeting || t.meeting_code === meeting) && (!mine || (t.assignee_id === user?.id || t.created_by === user?.id || t.assignee_name === 'You' || (user?.full_name && t.assignee_name === user.full_name)))), [all, source, meeting, mine, user]);
  const open = filtered.filter((t) => t.status !== 'done');
  const done = filtered.filter((t) => t.status === 'done');
  const add = (e) => { e.preventDefault(); if (!title.trim()) return; create.mutate({ title: title.trim(), due_date: due || null }); setTitle(''); setDue(''); };

  return (
    <div className="p-5 md:p-7 max-w-[980px]">
      <form onSubmit={add} className="flex flex-wrap gap-2 rounded-[18px] border border-line bg-surface-2 p-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task" aria-label="New task title" className="flex-1 min-w-[200px] bg-transparent px-3 h-10 outline-none text-[15px] placeholder:text-ink-3" />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className="input h-10 w-auto text-[14px]" />
        <button className="btn btn-primary" disabled={!title.trim()}><Plus size={16} />Add</button>
      </form>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Segmented label="Status" value={status} onChange={setStatus} options={[{ value: 'open', label: 'Open', count: all.filter((t) => t.status !== 'done').length }, { value: 'all', label: 'All', count: all.length }]} />
        <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source" className="input h-10 w-auto text-[14px] font-semibold"><option value="all">Any source</option><option value="ai">From the minutes</option><option value="assistant">From the assistant</option><option value="user">Added by you</option></select>
        <select value={meeting} onChange={(e) => setMeeting(e.target.value)} aria-label="Meeting" className="input h-10 w-auto max-w-[220px] text-[14px] font-semibold"><option value="">All meetings</option>{meetings.map(([c, t]) => <option key={c} value={c}>{t}</option>)}</select>
        <label className="inline-flex items-center gap-2 text-[14px] font-semibold text-ink-2 cursor-pointer"><Switch checked={mine} onCheckedChange={setMine} aria-label="Assigned to me" />Assigned to me</label>
      </div>
      {q.isLoading ? <SkeletonRows rows={5} className="mt-6" /> : q.isError ? <ErrorState error={q.error} onRetry={q.refetch} /> : (
        <div className="mt-6 space-y-8">
          {GROUPS.map((g) => { const items = open.filter((t) => groupOf(t) === g); if (!items.length) return null; return (
            <section key={g} aria-labelledby={`g-${g}`}>
              <h2 id={`g-${g}`} className={cn('text-[13px] font-bold mb-1 flex items-center gap-2', g === 'Overdue' ? 'text-coral-ink' : 'text-ink-2')}>{g}<span className="tabnum text-ink-3 font-semibold">{items.length}</span></h2>
              <ul className="border-t border-line">{items.map((t) => <Row key={t.id} t={t} />)}</ul>
            </section>
          ); })}
          {!open.length && <EmptyState title={all.length ? 'Nothing open. Nice work.' : 'Tasks from your meetings and the assistant appear here.'} />}
          {(status === 'all' || done.length > 0) && !!done.length && (
            <section>
              <button onClick={() => setShowDone(!showDone)} aria-expanded={showDone || status === 'all'} className="flex items-center gap-2 text-[13px] font-bold text-ink-2"><ChevronDown size={15} className={cn('transition-transform', !(showDone || status === 'all') && '-rotate-90')} />Done<span className="tabnum text-ink-3">{done.length}</span></button>
              {(showDone || status === 'all') && <ul className="mt-1 border-t border-line">{done.map((t) => <Row key={t.id} t={t} />)}</ul>}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
