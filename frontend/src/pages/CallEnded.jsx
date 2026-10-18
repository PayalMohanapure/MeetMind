import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ThumbsUp, ThumbsDown, ArrowRight, Upload, Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useMeeting } from '@/hooks/queries';
import { useProcessingStatus } from '@/hooks/useProcessingStatus';
import { ProcessingStepper } from '@/components/record/ProcessingStepper';
import { Stage } from '@/components/three/Stage';
import { Logo } from '@/components/brand/Logo';
import { uploadsStore } from '@/lib/uploadsStore';
import { uploadRecording, endMeeting } from '@/api/meetings';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
import { duration } from '@/lib/format';
import { storage, cn } from '@/lib/utils';

export default function CallEnded() {
  const { code } = useParams();
  const qc = useQueryClient();
  const meeting = useMeeting(code, { refetchOnMount: 'always' });
  const m = meeting.data;
  const st = useProcessingStatus(code, m?.processing_status, { enabled: !!m?.record && m?.status === 'ended' });
  const status = st.data?.processing_status ?? m?.processing_status;
  const [pending, setPending] = useState([]);
  const [rating, setRating] = useState(() => storage.get(`mm-rate-${code}`, 0));
  useEffect(() => { uploadsStore.pending(code).then(setPending); }, [code]);
  useEffect(() => { document.title = 'Call ended · MeetMind'; }, []);
  useEffect(() => { if (status === 'ready') { qc.invalidateQueries({ queryKey: ['meetings'] }); qc.invalidateQueries({ queryKey: ['actionItems'] }); } }, [status, qc]);
  const retryUploads = async () => {
    for (const it of pending) { try { await uploadRecording(code, it.blob, it.meta); await uploadsStore.remove(code, it.index); } catch { /* keep */ } }
    setPending(await uploadsStore.pending(code));
  };
  const rate = (v) => { setRating(v); storage.set(`mm-rate-${code}`, v); };
  const live = m?.status === 'live';
  const ready = status === 'ready';

  return (
    <div className="min-h-screen bg-canvas">
      <header className="h-16 px-4 md:px-8 flex items-center"><Link to="/app" aria-label="MeetMind home"><Logo size={26} className="!text-[18px]" /></Link></header>
      <main className="mx-auto max-w-[880px] px-4 md:px-8 pb-16 pt-6">
        <h1 className="display text-[40px] md:text-[52px] leading-[1]">You left {m?.title || 'the meeting'}.</h1>
        {m && <p className="mt-3 text-[17px] text-ink-2">{m.status === 'ended' ? `The call lasted ${duration(m.duration_seconds)}.` : 'The call is still going for the others.'}</p>}
        <div className="mt-7 flex flex-wrap gap-3">
          {live && <Link to={`/app/meet/${code}/lobby`} className="btn btn-primary btn-lg">Rejoin</Link>}
          {live && m?.is_host && <button onClick={async () => { try { await endMeeting(code); await meeting.refetch(); st.refetch(); toast('Meeting ended. Writing the minutes.'); } catch (e) { toast(errorMessage(e)); } }} className="btn btn-danger btn-lg">End for everyone{m.record ? ' and write minutes' : ''}</button>}
          <Link to="/app" className={cn('btn btn-lg', live ? 'btn-ghost' : 'btn-primary')}>Go to Home</Link>
        </div>

        {m?.record && m.status === 'ended' && (
          <section className="mt-10 dusk aurora grain rounded-[28px] overflow-hidden shadow-float" aria-live="polite">
            <div className="relative z-[1] grid md:grid-cols-[1fr_260px] items-center">
              <div className="p-6 md:p-8">
                <p className="font-display text-[26px] font-bold text-white">{ready ? 'Your minutes are ready' : status === 'failed' ? 'The minutes could not be written' : 'Writing the minutes'}</p>
                <p className="mt-1.5 text-dt2 text-[15px] mb-6">{ready ? 'Decisions, tasks and a searchable transcript, linked to the moment each was said.' : 'This usually takes a few minutes. You can leave this page; we’ll let you know on Home.'}</p>
                <ProcessingStepper dark status={status} error={st.data?.error} canRetry={false} />
                {ready && <Link to={`/app/meetings/${code}`} className="btn btn-white btn-lg mt-7">Open the minutes<ArrowRight size={17} /></Link>}
              </div>
              <Stage variant="minutes" className="h-[240px] md:h-full md:min-h-[300px]" />
            </div>
          </section>
        )}

        {!!pending.length && (
          <div className="mt-5 card p-4 flex flex-wrap items-center gap-3"><Upload size={18} className="text-ink-2" /><p className="flex-1 text-[14px]">{pending.length} part{pending.length > 1 ? 's' : ''} of your recording still need to upload.</p><button className="btn btn-ghost btn-sm" onClick={retryUploads}>Upload now</button></div>
        )}

        <section className="mt-8 card p-5 flex flex-wrap items-center gap-4" aria-label="Call quality">
          <p className="font-semibold flex-1">How was the call?</p>
          {rating ? <p className="text-[14px] text-ok-ink font-semibold inline-flex items-center gap-1.5"><Check size={16} />Thanks for the feedback</p> : (
            <div className="flex gap-2">
              <button onClick={() => rate(1)} className="btn btn-ghost"><ThumbsUp size={16} />Good</button>
              <button onClick={() => rate(-1)} className="btn btn-ghost"><ThumbsDown size={16} />Had problems</button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
