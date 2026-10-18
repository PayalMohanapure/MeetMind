import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { createMeeting } from '@/api/meetings';
import { errorMessage } from '@/lib/errors';
import { storage } from '@/lib/utils';
import { inviteUrl } from '@/lib/inviteLink';

/** mode: 'now' | 'schedule' | 'link' */
export function CreateMeetingDialog({ open, onOpenChange, mode = 'now' }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [record, setRecord] = useState(() => storage.get('mm-record', true));
  const [when, setWhen] = useState(() => { const d = new Date(Date.now() + 3600e3); d.setMinutes(0, 0, 0); return toLocalInput(d); });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const m = await createMeeting({ title: title.trim() || defaultTitle(), record, scheduled_at: mode === 'schedule' ? new Date(when).toISOString() : undefined });
      storage.set('mm-record', record);
      qc.invalidateQueries({ queryKey: ['meetings'] });
      onOpenChange(false);
      if (mode === 'now') { toast('Meeting started'); nav(`/app/meet/${m.code}/lobby`); }
      else {
        await navigator.clipboard?.writeText(inviteUrl(m.code)).catch(() => {});
        toast(mode === 'schedule' ? 'Meeting scheduled. Link copied.' : 'Link created and copied');
      }
    } catch (x) { setErr(errorMessage(x)); } finally { setBusy(false); }
  };

  const titles = { now: 'Start a meeting', schedule: 'Schedule a meeting', link: 'Create a link to share' };
  const verbs = { now: 'Start meeting', schedule: 'Schedule meeting', link: 'Create link' };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={titles[mode]} description={mode === 'link' ? 'Share the link now; the room opens when someone joins.' : undefined}>
      <form onSubmit={submit} className="space-y-5">
        <Field label="Meeting name" placeholder={defaultTitle()} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={120} />
        {mode === 'schedule' && <Field label="Date and time" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />}
        <label className="flex items-center justify-between gap-4 rounded-[14px] border border-line p-4 cursor-pointer">
          <span><span className="block font-semibold text-[14px]">Record and write minutes</span><span className="block text-[13px] text-ink-2">Everyone sees that the call is recorded.</span></span>
          <Switch checked={record} onCheckedChange={setRecord} aria-label="Record and write minutes" />
        </label>
        {err && <p className="field-error" role="alert">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => onOpenChange(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Working…' : verbs[mode]}</button>
        </div>
      </form>
    </Dialog>
  );
}
const defaultTitle = () => `Meeting on ${new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}`;
const toLocalInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
