import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { listMeetings } from '@/api/meetings';
import { useVisible, ACTIVE } from './useProcessingStatus';
import { storage } from '@/lib/utils';

/** Polls meetings ended in the last hour; toasts once when their minutes become ready. */
export function useMinutesReadyNotifier(enabled = true) {
  const visible = useVisible();
  const nav = useNavigate();
  const qc = useQueryClient();
  const seen = useRef(new Set(storage.get('mm-notified', [])));
  const { data } = useQuery({
    queryKey: ['meetings', { status: 'ended' }, 'notifier'],
    queryFn: () => listMeetings({ status: 'ended' }),
    enabled,
    refetchInterval: (q) => {
      const recent = (q.state.data || []).some((m) => ACTIVE.includes(m.processing_status) && Date.now() - new Date(m.ended_at) < 3600e3);
      return visible && recent ? 15000 : visible ? 60000 : false;
    },
  });
  const prev = useRef({});
  useEffect(() => {
    (data || []).forEach((m) => {
      const was = prev.current[m.code];
      if (was && ACTIVE.includes(was) && m.processing_status === 'ready' && !seen.current.has(m.code)) {
        seen.current.add(m.code); storage.set('mm-notified', [...seen.current].slice(-50));
        qc.invalidateQueries({ queryKey: ['meetings'] });
        toast(`Minutes for ${m.title} are ready.`, { action: { label: 'Open', onClick: () => nav(`/app/meetings/${m.code}`) }, duration: 10000 });
      }
      prev.current[m.code] = m.processing_status;
    });
  }, [data, nav, qc]);
}
