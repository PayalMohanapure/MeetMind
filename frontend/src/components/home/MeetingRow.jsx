import { Link, useNavigate } from 'react-router';
import { CalendarClock, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { AvatarStack } from '@/components/brand/VoiceAvatar';
import { StatusBadge } from '@/components/brand/Indicators';
import { MiniVoiceprint } from '@/components/brand/MiniVoiceprint';
import { meetingDate, duration, minutesAgo, dateTime } from '@/lib/format';
import { inviteUrl } from '@/lib/inviteLink';

function shares(m) {
  if (m.talk_share?.length) return m.talk_share.map((s) => ({ id: s.user_id, name: s.full_name, value: s.seconds }));
  if (m.processing_status !== 'ready') return [];
  // Fallback when the API doesn't send talk share: a stable pseudo-split per participant.
  return (m.participants || []).map((p, i) => ({ id: p.user_id, name: p.full_name, value: 3 + ((p.user_id || '').length * 7 + i * 5) % 9 }));
}

export function MeetingRow({ m, showPeople = true }) {
  const nav = useNavigate();
  const live = m.status === 'live';
  const sched = m.status === 'scheduled';
  const href = live || sched ? `/app/meet/${m.code}/lobby` : `/app/meetings/${m.code}`;
  const meta = live ? [meetingDate(m.started_at), `started ${minutesAgo(m.started_at)} min ago`] : sched ? [dateTime(m.scheduled_at)] : [meetingDate(m.started_at || m.created_at), duration(m.duration_seconds)];
  return (
    <li className="relative group grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,1.6fr)_auto_minmax(120px,1fr)_96px] items-center gap-x-5 gap-y-1 py-3.5 px-3 -mx-3 rounded-[16px] hover:bg-surface-2 transition-colors border-b border-line last:border-b-0">
      <div className="min-w-0">
        <Link to={href} className="font-semibold text-[15px] truncate block after:absolute after:inset-0 after:content-['']">{m.title}</Link>
        <p className="text-[13px] text-ink-2 flex flex-wrap gap-x-3">{meta.map((x, i) => <span key={i}>{x}</span>)}</p>
      </div>
      {showPeople && <div className="hidden md:block"><AvatarStack people={m.participants} max={4} size={26} /></div>}
      <div className="hidden md:flex items-center relative z-[1]">
        {live ? <button onClick={() => nav(href)} className="btn btn-ghost btn-sm">Rejoin</button>
          : sched ? <button onClick={() => { navigator.clipboard?.writeText(inviteUrl(m.code)); toast('Invite link copied'); }} className="btn btn-quiet btn-sm text-ink-2"><Copy size={14} />Copy link</button>
          : <MiniVoiceprint shares={shares(m)} className="w-full max-w-[160px]" />}
      </div>
      <div className="justify-self-end max-md:row-start-1 max-md:col-start-2"><StatusBadge meeting={m} /></div>
    </li>
  );
}

export function UpcomingChip({ m }) {
  return (
    <Link to={`/app/meet/${m.code}/lobby`} className="flex items-center gap-3 rounded-[16px] border border-line p-3.5 hover:bg-surface-2 transition-colors">
      <span className="h-10 w-10 rounded-[12px] bg-cobalt-soft text-cobalt grid place-items-center"><CalendarClock size={18} /></span>
      <span className="min-w-0"><span className="block font-semibold truncate">{m.title}</span><span className="block text-[13px] text-ink-2">{dateTime(m.scheduled_at)}</span></span>
    </Link>
  );
}
