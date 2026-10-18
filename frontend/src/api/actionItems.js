import { api } from '@/lib/api';
import { ACTION_ITEMS } from './endpoints';
import { normTask, listOf } from './normalize';

const out = (d) => {
  const b = {};
  if (d.title !== undefined) b.description = d.title;
  if (d.description !== undefined) b.description = d.description;
  if (d.status !== undefined) b.status = d.status;
  if (d.due_date !== undefined) b.due_date = d.due_date || null;
  if (d.meeting_code !== undefined) b.meeting_code = d.meeting_code;
  if (d.assignee_name !== undefined) b.assignee_name = d.assignee_name;
  return b;
};
export async function listActionItems(f = {}) {
  const q = {};
  if (f.status === 'open' || f.status === 'done') q.status = f.status;
  if (f.meeting_code) q.meetingCode = f.meeting_code;
  return listOf(await api.get(ACTION_ITEMS.list, { query: q })).map(normTask);
}
export const createActionItem = async (d) => normTask(await api.post(ACTION_ITEMS.create, out(d)));
export const updateActionItem = async (id, d) => normTask(await api.patch(ACTION_ITEMS.update(id), out(d)));
export const deleteActionItem = (id) => api.del(ACTION_ITEMS.remove(id));
