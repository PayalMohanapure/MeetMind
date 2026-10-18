import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as M from '@/api/meetings';
import * as A from '@/api/actionItems';
import * as G from '@/api/agent';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';

export const useMeetings = (f = {}) => useQuery({ queryKey: ['meetings', f], queryFn: () => M.listMeetings(f) });
export const useMeeting = (code, opts = {}) => useQuery({ queryKey: ['meeting', code], queryFn: () => M.getMeeting(code), enabled: !!code, ...opts });
export const useTranscript = (code, enabled = true) => useQuery({ queryKey: ['transcript', code], queryFn: () => M.getTranscript(code), enabled: !!code && enabled });
export const useSummary = (code, enabled = true) => useQuery({ queryKey: ['summary', code], queryFn: () => M.getSummary(code), enabled: !!code && enabled, retry: false });
export const useActionItems = (f = {}) => useQuery({ queryKey: ['actionItems', f], queryFn: () => A.listActionItems(f) });
export const useConversations = () => useQuery({ queryKey: ['conversations'], queryFn: G.listConversations });
export const useConversation = (id) => useQuery({ queryKey: ['conversation', id], queryFn: () => G.getConversation(id), enabled: !!id });

/** Optimistic task update with rollback. */
export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...d }) => A.updateActionItem(id, d),
    onMutate: async ({ id, ...d }) => {
      await qc.cancelQueries({ queryKey: ['actionItems'] });
      const snaps = qc.getQueriesData({ queryKey: ['actionItems'] });
      snaps.forEach(([k, v]) => Array.isArray(v) && qc.setQueryData(k, v.map((i) => (i.id === id ? { ...i, ...d } : i))));
      return { snaps };
    },
    onError: (e, _v, ctx) => { ctx?.snaps.forEach(([k, v]) => qc.setQueryData(k, v)); toast(`Couldn't save the task. ${errorMessage(e)}`); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['actionItems'] }),
  });
}
export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: A.createActionItem,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['actionItems'] }); toast('Task added'); },
    onError: (e) => toast(errorMessage(e)),
  });
}
export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: A.deleteActionItem,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['actionItems'] }); toast('Task deleted'); },
  });
}
