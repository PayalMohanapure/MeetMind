import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Command, defaultFilter } from 'cmdk';
import { Dialog as D } from 'radix-ui';
import { Home, Video, Sparkles, CheckSquare, Settings, Plus, LogIn, MessageSquare, Search, CornerDownLeft } from 'lucide-react';
import { useMeetings, useConversations } from '@/hooks/queries';
import { parseMeetingCode } from '@/lib/inviteLink';
import { StatusBadge } from '@/components/brand/Indicators';

export function CommandPalette({ open, onOpenChange, onNewMeeting }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const { data: meetings } = useMeetings();
  const { data: convs } = useConversations();
  const go = (fn) => { onOpenChange(false); setQ(''); fn(); };
  const code = parseMeetingCode(q);
  const Item = ({ icon: Icon, children, onSelect, value, right }) => (
    <Command.Item value={value} onSelect={() => go(onSelect)} className="flex items-center gap-3 h-11 px-3 rounded-[12px] text-[14px] font-medium text-ink cursor-pointer data-[selected=true]:bg-surface-2">
      <Icon size={17} strokeWidth={1.75} className="text-ink-2 shrink-0" /><span className="flex-1 truncate">{children}</span>{right}
    </Command.Item>
  );
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-[rgba(16,20,52,.42)] backdrop-blur-[3px]" />
        <D.Content className="fixed left-1/2 top-[12vh] z-50 w-[min(640px,calc(100vw-24px))] -translate-x-1/2 rounded-[22px] bg-surface shadow-float overflow-hidden focus:outline-none anim-rise">
          <D.Title className="sr-only">Search or ask MeetMind</D.Title>
          <D.Description className="sr-only">Jump to a page, a meeting, or ask the assistant.</D.Description>
          <Command label="Command palette" loop filter={(value, search, kw) => (value.startsWith('zz-') ? 0.001 : defaultFilter(value, search, kw))}>
            <div className="flex items-center gap-3 px-5 h-14 border-b border-line">
              <Search size={18} className="text-ink-3" />
              <Command.Input value={q} onValueChange={setQ} placeholder="Search, paste a meeting link, or ask a question" className="flex-1 h-full bg-transparent outline-none text-[15px] placeholder:text-ink-3" />
              <span className="kbd">Esc</span>
            </div>
            <Command.List className="max-h-[56vh] overflow-y-auto p-2 scroll-thin">
              <Command.Empty className="py-8 text-center text-ink-2 text-[14px]">No matches. Press Enter on "Ask MeetMind" to search your meetings.</Command.Empty>
              <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ink-3">
                <Item icon={Plus} value="new meeting start" onSelect={onNewMeeting}>New meeting</Item>
                <Item icon={LogIn} value="join with code or link" onSelect={() => nav('/app', { state: { focusJoin: true } })}>Join with a code or link</Item>
              </Command.Group>
              <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ink-3">
                <Item icon={Home} value="go home" onSelect={() => nav('/app')}>Home</Item>
                <Item icon={Video} value="go meetings" onSelect={() => nav('/app/meetings')}>Meetings</Item>
                <Item icon={Sparkles} value="go assistant" onSelect={() => nav('/app/assistant')}>Assistant</Item>
                <Item icon={CheckSquare} value="go tasks action items" onSelect={() => nav('/app/action-items')}>Tasks</Item>
                <Item icon={Settings} value="go settings" onSelect={() => nav('/app/settings')}>Settings</Item>
              </Command.Group>
              {!!meetings?.length && (
                <Command.Group heading="Meetings" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ink-3">
                  {meetings.slice(0, 8).map((m) => <Item key={m.code} icon={Video} value={`meeting ${m.title} ${m.code}`} onSelect={() => nav(m.status === 'live' ? `/app/meet/${m.code}/lobby` : `/app/meetings/${m.code}`)} right={<StatusBadge meeting={m} />}>{m.title}</Item>)}
                </Command.Group>
              )}
              {!!convs?.length && (
                <Command.Group heading="Conversations" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ink-3">
                  {convs.slice(0, 5).map((c) => <Item key={c.id} icon={MessageSquare} value={`conversation ${c.title}`} onSelect={() => nav(`/app/assistant/${c.id}`)}>{c.title}</Item>)}
                </Command.Group>
              )}
              {q.trim() && (
                <Command.Group heading="Ask" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ink-3">
                  <Item icon={Sparkles} value={`zz-ask ${q}`} onSelect={() => nav('/app/assistant', { state: { ask: q.trim() } })} right={<CornerDownLeft size={14} className="text-ink-3" />}>Ask MeetMind: <span className="text-iris-ink">{q}</span></Item>
                  {code && <Item icon={LogIn} value={`zz-join ${q}`} onSelect={() => nav(`/app/meet/${code}/lobby`)}>Join meeting {code}</Item>}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
