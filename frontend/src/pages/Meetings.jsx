import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useMeetings } from '@/hooks/queries';
import { Segmented } from '@/components/ui/Segmented';
import { MeetingRow } from '@/components/home/MeetingRow';
import { SkeletonRows, ErrorState, EmptyState } from '@/components/common/States';
import { toDate } from '@/lib/format';
import { subDays, isAfter } from 'date-fns';

export default function Meetings() {
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [proc, setProc] = useState('');
  const [range, setRange] = useState('any');
  const all = useMeetings();
  const list = useMemo(() => {
    let l = all.data || [];
    if (status !== 'all') l = l.filter((m) => m.status === status);
    if (q.trim()) { const s = q.toLowerCase(); l = l.filter((m) => m.title.toLowerCase().includes(s) || m.participants?.some((p) => p.full_name?.toLowerCase().includes(s))); }
    if (proc) l = l.filter((m) => (proc === 'processing' ? ['waiting_uploads', 'transcribing', 'embedding', 'summarizing'].includes(m.processing_status) : m.processing_status === proc));
    if (range !== 'any') { const since = subDays(new Date(), Number(range)); l = l.filter((m) => isAfter(toDate(m.started_at || m.scheduled_at || m.created_at), since)); }
    return l;
  }, [all.data, status, q, proc, range]);
  const count = (s) => (all.data || []).filter((m) => s === 'all' || m.status === s).length;
  const upcoming = list.filter((m) => m.status === 'scheduled');
  const rest = list.filter((m) => m.status !== 'scheduled');
  const filtered = status !== 'all' || q || proc || range !== 'any';

  return (
    <div className="p-5 md:p-7 max-w-[1360px]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-[320px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title or person" aria-label="Search meetings" className="input input-soft h-10 pl-10 text-[14px]" />
        </div>
        <Segmented label="Filter by status" value={status} onChange={setStatus} options={[{ value: 'all', label: 'All', count: count('all') }, { value: 'live', label: 'Live', count: count('live') }, { value: 'ended', label: 'Ended', count: count('ended') }, { value: 'scheduled', label: 'Scheduled', count: count('scheduled') }]} />
        <select value={proc} onChange={(e) => setProc(e.target.value)} aria-label="Minutes status" className="input h-10 w-auto pr-8 text-[14px] font-semibold">
          <option value="">Any minutes status</option><option value="ready">Ready</option><option value="processing">Processing</option><option value="failed">Failed</option>
        </select>
        <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range" className="input h-10 w-auto pr-8 text-[14px] font-semibold">
          <option value="any">Any time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>
        </select>
        {filtered && <button onClick={() => { setStatus('all'); setQ(''); setProc(''); setRange('any'); }} className="btn btn-quiet btn-sm"><X size={14} />Clear filters</button>}
      </div>

      {all.isLoading ? <SkeletonRows rows={6} className="mt-6" /> : all.isError ? <ErrorState error={all.error} onRetry={all.refetch} /> : (
        <>
          {!!upcoming.length && (
            <section className="mt-8" aria-labelledby="mu-h"><h2 id="mu-h" className="h-section mb-2">Upcoming</h2><ul className="border-t border-line">{upcoming.map((m) => <MeetingRow key={m.code} m={m} />)}</ul></section>
          )}
          {!!rest.length && (
            <section className="mt-8" aria-labelledby="mr-h"><h2 id="mr-h" className="h-section mb-2">{status === 'live' ? 'Live now' : 'All meetings'}</h2><ul className="border-t border-line" data-testid="meeting-list">{rest.map((m) => <MeetingRow key={m.code} m={m} />)}</ul></section>
          )}
          {!list.length && <EmptyState title={filtered ? 'No meetings match these filters.' : 'No meetings yet. Start one from Home.'} action={filtered ? <button className="btn btn-ghost" onClick={() => { setStatus('all'); setQ(''); setProc(''); setRange('any'); }}>Clear filters</button> : null} />}
        </>
      )}
    </div>
  );
}
