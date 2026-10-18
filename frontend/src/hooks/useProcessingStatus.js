import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getStatus } from '@/api/meetings';

const useVisible = () => {
  const [v, setV] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => { const f = () => setV(!document.hidden); document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, []);
  return v;
};
export const ACTIVE = ['waiting_uploads', 'transcribing', 'embedding', 'summarizing'];

/** Polls processing status every 4s while the tab is visible and processing is active. */
export function useProcessingStatus(code, initial, { enabled = true } = {}) {
  const visible = useVisible();
  return useQuery({
    queryKey: ['status', code],
    queryFn: () => getStatus(code),
    enabled: !!code && enabled,
    placeholderData: initial ? { processing_status: initial } : undefined,
    staleTime: 0,
    refetchInterval: (q) => (visible && ACTIVE.includes(q.state.data?.processing_status) ? 4000 : false),
  });
}
export { useVisible };
