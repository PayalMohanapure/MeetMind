import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ChevronDown, CalendarPlus, Link2, Video } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/Switch';
import { Menu, MenuTrigger, MenuContent, MenuItem } from '@/components/ui/Menu';
import { Stage } from '@/components/three/Stage';
import { CreateMeetingDialog } from '@/components/common/CreateMeetingDialog';
import { createMeeting } from '@/api/meetings';
import { errorMessage } from '@/lib/errors';
import { storage } from '@/lib/utils';
import { features } from '@/config/features';

export function StartCard() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [record, setRecord] = useState(() => storage.get('mm-record', true));
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const startNow = async () => {
    setBusy(true);
    try {
      const m = await createMeeting({ title: `Meeting on ${new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}`, record });
      qc.invalidateQueries({ queryKey: ['meetings'] });
      toast('Meeting started');
      nav(`/app/meet/${m.code}/lobby`);
    } catch (e) { toast(errorMessage(e)); setBusy(false); }
  };
  return (
    <section className="dusk relative overflow-hidden rounded-[26px] aurora-card grain text-white min-h-[264px] shadow-float" aria-labelledby="start-h">
      <Stage variant="mini" className="absolute right-[-30px] top-1/2 -translate-y-1/2 h-[300px] w-[300px] hidden sm:block" />
      <div className="relative z-[2] p-7 max-w-[400px] flex flex-col h-full">
        <h2 id="start-h" className="display text-[34px] leading-[1.02]">Start a meeting in one click</h2>
        <p className="mt-3 text-[15px] text-white/85 max-w-[36ch]">MeetMind records, transcribes and writes the minutes for you.</p>
        <div className="mt-6 flex items-center">
          <button onClick={startNow} disabled={busy} className="btn btn-white btn-lg rounded-r-none pr-5"><Video size={17} className="text-cobalt" />{busy ? 'Starting…' : 'Start now'}</button>
          <Menu>
            <MenuTrigger className="btn btn-white btn-lg rounded-l-none border-l border-line px-3" aria-label="More ways to start"><ChevronDown size={18} /></MenuTrigger>
            <MenuContent align="start">
              <MenuItem icon={Video} onSelect={startNow}>Start now</MenuItem>
              {features.schedule && <MenuItem icon={CalendarPlus} onSelect={() => setDialog('schedule')}>Schedule for later</MenuItem>}
              <MenuItem icon={Link2} onSelect={() => setDialog('link')}>Create a link to share</MenuItem>
            </MenuContent>
          </Menu>
        </div>
        <label className="mt-5 inline-flex items-center gap-3 text-[14px] font-medium cursor-pointer">
          <Switch onWhite={false} checked={record} onCheckedChange={(v) => { setRecord(v); storage.set('mm-record', v); }} aria-label="Record and write minutes" />Record and write minutes
        </label>
      </div>
      {dialog && <CreateMeetingDialog open onOpenChange={(o) => !o && setDialog(null)} mode={dialog} />}
    </section>
  );
}
