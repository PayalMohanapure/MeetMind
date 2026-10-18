import { Link } from 'react-router';
import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useMeetings, useActionItems } from '@/hooks/queries';
import { StartCard } from '@/components/home/StartCard';
import { JoinCard } from '@/components/home/JoinCard';
import { MeetingRow, UpcomingChip } from '@/components/home/MeetingRow';
import { TaskRow } from '@/components/home/MyTasks';
import { SkeletonRows, ErrorState, EmptyState } from '@/components/common/States';
import { greeting, thisWeek, duration } from '@/lib/format';
import { firstName } from '@/lib/utils';

export default function Home() {
  const { user } = useAuth();
  const meetings = useMeetings();
  const tasks = useActionItems({ status: 'open' });
  const list = useMemo(() => meetings.data || [], [meetings.data]);
  const upcoming = list.filter((m) => m.status === 'scheduled').slice(0, 3);
  const recent = list.filter((m) => m.status !== 'scheduled').slice(0, 5);
  const myTasks = (tasks.data || []).filter((t) => t.status !== 'done' && (t.assignee_id === user?.id || t.created_by === user?.id || t.assignee_name === 'You' || (user?.full_name && t.assignee_name === user.full_name))).slice(0, 5);
  const week = useMemo(() => {
    const w = list.filter((m) => m.status !== 'scheduled' && thisWeek(m.started_at));
    if (!w.length) return null;
    const secs = w.reduce((a, m) => a + (m.duration_seconds || 0), 0);
    const open = (tasks.data || []).length;
    return `This week: ${w.length} meeting${w.length > 1 ? 's' : ''}, ${duration(secs)} of conversation, ${open} open task${open === 1 ? '' : 's'}.`;
  }, [list, tasks.data]);

  return (
    <div className="p-5 md:p-7 max-w-[1360px] space-y-8">
      <header>
        <h2 className="h-page">{greeting()}, {firstName(user?.full_name)}</h2>
        {week && <p className="mt-2 text-ink-2 text-[15px]">{week}</p>}
      </header>
      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <StartCard />
        <JoinCard user={user} meetingsCount={list.length} />
      </div>
      {!!upcoming.length && (
        <section aria-labelledby="up-h">
          <h2 id="up-h" className="h-section mb-3">Upcoming</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{upcoming.map((m) => <UpcomingChip key={m.code} m={m} />)}</div>
        </section>
      )}
      <div className="grid gap-8 lg:grid-cols-[1.45fr_1fr]">
        <section aria-labelledby="recent-h">
          <div className="flex items-center justify-between mb-2"><h2 id="recent-h" className="h-section">Recent meetings</h2>{!!recent.length && <Link to="/app/meetings" className="text-[14px] link">View all</Link>}</div>
          <div className="border-t border-line">
            {meetings.isLoading ? <SkeletonRows /> : meetings.isError ? <ErrorState error={meetings.error} onRetry={meetings.refetch} /> : recent.length ? <ul>{recent.map((m) => <MeetingRow key={m.code} m={m} />)}</ul> : <EmptyState title="Your first meeting will appear here." action={<p className="text-[13px] text-ink-3">Use Start now above.</p>} />}
          </div>
        </section>
        <section aria-labelledby="tasks-h">
          <div className="flex items-center justify-between mb-2"><h2 id="tasks-h" className="h-section">My open tasks</h2>{!!myTasks.length && <Link to="/app/action-items" className="text-[14px] link">All tasks</Link>}</div>
          <div className="border-t border-line">
            {tasks.isLoading ? <SkeletonRows rows={3} /> : tasks.isError ? <ErrorState error={tasks.error} onRetry={tasks.refetch} /> : myTasks.length ? <ul>{myTasks.map((t) => <TaskRow key={t.id} t={t} compact />)}</ul> : <EmptyState orb={false} title="No open tasks. Tasks from your meetings show up here." />}
          </div>
        </section>
      </div>
    </div>
  );
}
