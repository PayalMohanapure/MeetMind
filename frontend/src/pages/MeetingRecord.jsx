import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ChevronLeft, Download, Sparkles, Copy, FileText, CalendarDays, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useMeeting, useTranscript, useSummary, useActionItems, useUpdateTask } from '@/hooks/queries';
import { useProcessingStatus } from '@/hooks/useProcessingStatus';
import { AvatarStack } from '@/components/brand/VoiceAvatar';
import { StatusBadge } from '@/components/brand/Indicators';
import { Menu, MenuTrigger, MenuContent, MenuItem } from '@/components/ui/Menu';
import { Sheet } from '@/components/ui/Dialog';
import { Voiceprint } from '@/components/record/Voiceprint';
import { TranscriptView } from '@/components/record/TranscriptView';
import { MinutesPanel } from '@/components/record/MinutesPanel';
import { SummaryHero } from '@/components/record/SummaryHero';
import { ProcessingStepper } from '@/components/record/ProcessingStepper';
import { speakersFrom } from '@/components/record/speakers';
import { AssistantChat } from '@/components/ai/AssistantChat';
import { ErrorState } from '@/components/common/States';
import { reprocess } from '@/api/meetings';
import { dateTime, duration, clock } from '@/lib/format';
import { errorMessage } from '@/lib/errors';

function toMarkdown(m, s, segs, tasks) {
  const L = [`# ${m.title}`, '', `${dateTime(m.started_at)} · ${duration(m.duration_seconds)}`, ''];
  if (s) {
    L.push('## Summary', s.summary, '', '## Decisions', ...s.decisions.map((d) => `- ${d.text} (${clock(d.start)})`), '');
    if (s.open_questions?.length) L.push('## Open questions', ...s.open_questions.map((d) => `- ${d.text}`), '');
  }
  if (tasks.length) L.push('## Tasks', ...tasks.map((t) => `- [${t.status === 'done' ? 'x' : ' '}] ${t.title} (${t.assignee_name})`), '');
  L.push('## Transcript', ...segs.map((g) => `**${clock(g.start)} ${g.speaker_name}:** ${g.text}`));
  return L.join('\n');
}

export default function MeetingRecord() {
  const { code } = useParams();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const meeting = useMeeting(code);
  const m = meeting.data;
  const st = useProcessingStatus(code, m?.processing_status, { enabled: !!m && m.status === 'ended' });
  const pstatus = st.data?.processing_status ?? m?.processing_status;
  const ready = pstatus === 'ready';
  const transcript = useTranscript(code, ready);
  const summary = useSummary(code, ready);
  const tasksQ = useActionItems({ meeting_code: code });
  const updateTask = useUpdateTask();
  const segments = useMemo(() => transcript.data?.segments || [], [transcript.data]);
  const speakers = useMemo(() => speakersFrom(segments), [segments]);
  const tasks = tasksQ.data || [];
  const tParam = params.get('t');
  const [t, setT] = useState(() => Number(tParam) || 0);
  const [askOpen, setAskOpen] = useState(false);
  const tv = useRef(null);
  const prevStatus = useRef(pstatus);

  useEffect(() => { if (m) document.title = `${m.title} · MeetMind`; }, [m]);
  useEffect(() => {
    if (prevStatus.current && prevStatus.current !== 'ready' && pstatus === 'ready') { qc.invalidateQueries({ queryKey: ['actionItems'] }); qc.invalidateQueries({ queryKey: ['meeting', code] }); }
    prevStatus.current = pstatus;
  }, [pstatus, qc, code]);

  const seek = (s) => { setT(s); tv.current?.scrollTo(s); setParams((p) => { p.set('t', String(Math.round(s))); return p; }, { replace: true }); };
  const exportMd = (copy) => {
    const md = toMarkdown(m, summary.data, segments, tasks);
    if (copy) { navigator.clipboard?.writeText(md); toast('Minutes copied'); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' })); a.download = `${m.title.replace(/\W+/g, '-').toLowerCase()}.md`; a.click();
    toast('Minutes exported');
  };

  if (meeting.isError) return <div className="p-7 max-w-[900px]"><Link to="/app/meetings" className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-2 hover:text-ink"><ChevronLeft size={15} />Meetings</Link><ErrorState error={meeting.error} onRetry={meeting.refetch} /></div>;
  if (!m) return <div className="p-7 space-y-5" aria-busy="true"><div className="skeleton h-4 w-24" /><div className="skeleton h-9 w-80" /><div className="skeleton h-48 w-full rounded-[26px]" /><div className="skeleton h-28 w-full rounded-[20px]" /></div>;

  const counts = { decisions: summary.data?.decisions?.length, questions: summary.data?.open_questions?.length || summary.data?.key_points?.length, questionsLabel: summary.data?.open_questions?.length ? 'Open questions' : 'Key points', tasks: tasks.length };
  return (
    <div className="p-5 md:p-7 max-w-[1440px]">
      <Link to="/app/meetings" className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-2 hover:text-ink"><ChevronLeft size={15} />Meetings</Link>
      <header className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1">
          <h2 className="h-page text-[34px] md:text-[38px]">{m.title}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-ink-2">
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} />{dateTime(m.started_at || m.scheduled_at)}</span>
            {m.duration_seconds > 0 && <span className="inline-flex items-center gap-1.5"><Clock size={15} />{duration(m.duration_seconds)}</span>}
            <AvatarStack people={m.participants} size={26} />
            <StatusBadge meeting={{ ...m, processing_status: pstatus }} />
          </div>
        </div>
        <div className="flex gap-2">
          <Menu>
            <MenuTrigger className="btn btn-ghost" disabled={!ready}><Download size={16} />Export</MenuTrigger>
            <MenuContent>
              <MenuItem icon={FileText} onSelect={() => exportMd(false)}>Download as Markdown</MenuItem>
              <MenuItem icon={Copy} onSelect={() => exportMd(true)}>Copy minutes</MenuItem>
            </MenuContent>
          </Menu>
          <button className="btn btn-primary" onClick={() => setAskOpen(true)} disabled={!ready}><Sparkles size={16} />Ask about this meeting</button>
        </div>
      </header>

      {m.status === 'live' && <div className="mt-6 card p-5 flex flex-wrap items-center gap-4"><StatusBadge kind="live" /><p className="flex-1">This meeting is still going. Minutes are written after it ends.</p><Link to={`/app/meet/${code}/lobby`} className="btn btn-primary">Rejoin</Link></div>}
      {m.status === 'scheduled' && <div className="mt-6 card p-5 flex flex-wrap items-center gap-4"><StatusBadge kind="scheduled" /><p className="flex-1">Scheduled for {dateTime(m.scheduled_at)}.</p><Link to={`/app/meet/${code}/lobby`} className="btn btn-primary">Open lobby</Link></div>}
      {m.status === 'ended' && !ready && (
        <section className="mt-6 rounded-[26px] aurora-card grain dusk text-white p-6 md:p-8 shadow-float" aria-live="polite">
          <div className="relative z-[1]">
            <p className="font-display text-[22px] font-bold mb-5">{pstatus === 'failed' ? 'Writing the minutes failed' : pstatus === 'none' ? 'This meeting was not recorded' : 'Writing the minutes'}</p>
            {pstatus === 'none' ? <p className="text-white/80">Turn on "Record and write minutes" when you start a meeting to get a transcript and minutes.</p> : <ProcessingStepper dark status={pstatus} error={st.data?.error || m.processing_error} canRetry={m.is_host} onRetry={async () => { try { await reprocess(code); st.refetch(); toast('Processing restarted'); } catch (e) { toast(errorMessage(e)); } }} />}
          </div>
        </section>
      )}

      {ready && (
        <>
          <div className="mt-6">{summary.isLoading ? <div className="skeleton h-56 rounded-[26px]" /> : summary.data ? <SummaryHero summary={summary.data.summary} speakers={speakers} counts={counts} /> : null}</div>
          <section className="mt-5 sticky top-0 md:top-[-1px] z-20 rounded-[22px] border border-line bg-surface/95 backdrop-blur p-4 md:p-5 shadow-raise" aria-label="Timeline">
            {transcript.isLoading ? <div className="skeleton h-24" /> : <Voiceprint segments={segments} speakers={speakers} chapters={summary.data?.chapters || []} pins={tasks.filter((x) => x.heard_at !== null && x.heard_at !== undefined).map((x) => ({ start: x.heard_at, title: x.title }))} duration={m.duration_seconds} value={t} onSeek={seek} />}
          </section>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.55fr_1fr] items-start">
            <section aria-label="Transcript">
              <h3 className="h-section mb-3">Transcript</h3>
              {transcript.isError ? <ErrorState error={transcript.error} onRetry={transcript.refetch} /> : transcript.isLoading ? <div className="space-y-3">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-16" />)}</div> : <TranscriptView ref={tv} segments={segments} speakers={speakers} current={t} onSeek={seek} flashAt={tParam !== null ? Number(tParam) : undefined} />}
            </section>
            <div className="lg:sticky lg:top-[200px]">
              {summary.isError ? <ErrorState error={summary.error} onRetry={summary.refetch} /> : <MinutesPanel summary={summary.data} tasks={tasks} onSeek={seek} onToggleTask={(x, v) => updateTask.mutate({ id: x.id, status: v ? 'done' : 'open' })} />}
            </div>
          </div>
        </>
      )}
      <Sheet open={askOpen} onOpenChange={setAskOpen} title={`Ask about ${m.title}`}>
        <AssistantChat scope={{ code, title: m.title }} compact />
      </Sheet>
    </div>
  );
}
