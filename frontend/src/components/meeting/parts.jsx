import { useEffect, useRef, useState } from 'react';
import { MicOff, Hand, WifiOff, MoreHorizontal, Pin, PinOff, Copy, Send, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { LevelMeter } from '@/components/brand/Indicators';
import { VoiceAvatar } from '@/components/brand/VoiceAvatar';
import { Menu, MenuTrigger, MenuContent, MenuItem } from '@/components/ui/Menu';
import { Tip } from '@/components/ui/Tooltip';
import { useSpeakingLevel } from '@/hooks/useSpeakingLevel';
import { voiceColor, voiceText } from '@/lib/voiceColor';
import { inviteUrl, shortInvite } from '@/lib/inviteLink';
import { timeOnly } from '@/lib/format';
import { cn, initials } from '@/lib/utils';

const shade = (hex, a) => `${hex}${a}`;

/** One participant tile. Camera off → voice-colour gradient with a large avatar. */
export function VideoTile({ p, self, mirror, pinned, onPin, className, compact }) {
  const v = useRef(null);
  const level = useSpeakingLevel(p.stream && (self ? p.mic : true) ? p.stream : null);
  const speaking = p.speaking || (p.mic !== false && level > 0.12);
  const color = voiceColor(p.user_id || p.sid);
  const showVideo = p.stream && p.cam !== false && p.stream.getVideoTracks().length > 0;
  useEffect(() => { if (v.current && p.stream) v.current.srcObject = p.stream; }, [p.stream, showVideo]);
  const name = self ? 'You' : p.display_name;
  return (
    <div data-testid={self ? 'tile-self' : 'tile'} data-speaking={speaking ? 'true' : 'false'} className={cn('group relative rounded-tile overflow-hidden border-2 transition-[border-color,box-shadow] duration-200 min-h-0', speaking ? 'border-sun shadow-[0_0_0_4px_rgba(255,197,61,.18)]' : 'border-transparent', className)} style={{ background: `linear-gradient(150deg, ${shade(color, '55')}, ${shade(color, '1A')}), var(--d1)` }}>
      {showVideo ? (
        <video ref={v} autoPlay playsInline muted={self} className={cn('absolute inset-0 h-full w-full object-cover', self && mirror && '-scale-x-100', p.screen && 'object-contain bg-d0')} />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <span className={cn('grid place-items-center font-display font-bold text-white shadow-[0_18px_40px_-16px_rgba(0,0,0,.5)] transition-transform', speaking && 'scale-105', compact ? 'h-10 w-10 rounded-[12px] text-[15px] -mt-5' : 'h-[clamp(64px,9vw,108px)] w-[clamp(64px,9vw,108px)] rounded-[30%] text-[clamp(22px,3vw,38px)]')} style={{ background: color, color: voiceText(p.user_id || p.sid) }}>{initials(p.display_name || 'You')}</span>
          {!self && !showVideo && p.stream && <audio ref={v} autoPlay className="hidden" />}
        </div>
      )}
      <span className="absolute left-2.5 bottom-2.5 max-w-[calc(100%-20px)] h-7 rounded-[9px] glass-dark px-2.5 inline-flex items-center gap-2 text-[13px] font-semibold truncate">
        {speaking && p.mic !== false && <LevelMeter level={Math.max(level, 0.5)} />}{p.host && <Crown size={12} className="text-sun" />}<span className="truncate">{name}</span>
      </span>
      <div className="absolute right-2.5 top-2.5 flex gap-1.5">
        {p.hand && <span className="h-8 px-2 rounded-[10px] bg-sun text-[#1A2042] inline-flex items-center gap-1 text-[12px] font-bold" aria-label={`${name} raised a hand`}><Hand size={14} />Hand</span>}
        {p.quality === 'poor' && <span className="h-8 w-8 rounded-[10px] glass-dark grid place-items-center" aria-label="Poor connection"><WifiOff size={14} className="text-sun" /></span>}
        {p.mic === false && <span className="h-8 w-8 rounded-[10px] glass-dark grid place-items-center" aria-label={`${name} is muted`}><MicOff size={15} className="text-[#FF8A7E]" /></span>}
        {onPin && (
          <Menu>
            <MenuTrigger className="h-8 w-8 rounded-[10px] glass-dark grid place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100" aria-label={`Options for ${name}`}><MoreHorizontal size={15} /></MenuTrigger>
            <MenuContent dusk><MenuItem icon={pinned ? PinOff : Pin} onSelect={onPin}>{pinned ? 'Unpin' : 'Pin to the stage'}</MenuItem></MenuContent>
          </Menu>
        )}
      </div>
    </div>
  );
}

export function InviteTile({ code, className }) {
  return (
    <button onClick={() => { navigator.clipboard?.writeText(inviteUrl(code)); toast('Invite link copied'); }} className={cn('rounded-tile border-2 border-dashed border-dl grid place-items-center text-center p-4 hover:bg-white/[.03] transition-colors', className)} data-testid="invite-tile">
      <span>
        <span className="block font-semibold text-dt">Invite people</span>
        <span className="block text-[13.5px] text-dt2 mt-1">Copy the meeting link</span>
        <span className="mt-3 inline-flex items-center gap-2 h-8 rounded-full border border-dl bg-d1 px-3 text-[12.5px] text-dt2 tabnum"><Copy size={13} />{shortInvite(code)}</span>
      </span>
    </button>
  );
}

export function ChatPanel({ messages, onSend }) {
  const [text, setText] = useState('');
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);
  return (
    <div className="flex flex-col h-full min-h-0">
      <ol className="flex-1 min-h-0 overflow-y-auto scroll-thin p-4 space-y-3 text-[14px]" aria-live="polite" aria-label="Chat messages">
        {!messages.length && <li className="text-dt2 text-center py-8 text-[13.5px]">Messages are visible to everyone in the call.</li>}
        {messages.map((m, i) => (
          <li key={m.id || i} className={cn('flex flex-col', m.self ? 'items-end' : 'items-start')}>
            <span className="text-[12px] text-dt2 mb-1">{m.self ? 'You' : (m.display_name || '').split(' ')[0]}, {timeOnly(m.sent_at)}</span>
            <span className={cn('px-3 py-2 max-w-[90%] break-words', m.self ? 'bg-cobalt text-white rounded-[12px] rounded-br-[4px]' : 'bg-d2 rounded-[12px] rounded-bl-[4px]')}>{m.text}</span>
          </li>
        ))}
        <li ref={end} />
      </ol>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onSend(text.trim()); setText(''); } }} className="p-3 border-t border-dl flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message everyone" aria-label="Chat message" className="input h-10 bg-d2 border-dl text-[14px]" maxLength={1000} />
        <button className="btn btn-primary btn-icon h-10 w-10 shrink-0" disabled={!text.trim()} aria-label="Send message"><Send size={16} /></button>
      </form>
    </div>
  );
}

export function PeoplePanel({ me, peers }) {
  const all = [{ ...me, self: true }, ...peers];
  return (
    <ul className="p-3 space-y-1 overflow-y-auto scroll-thin" aria-label="People in the call">
      {all.map((p) => (
        <li key={p.sid} className="flex items-center gap-3 rounded-[12px] px-2 py-2 hover:bg-white/[.04]">
          <VoiceAvatar id={p.user_id || p.sid} name={p.display_name} size={32} ring={false} />
          <span className="flex-1 min-w-0 truncate text-[14px] font-semibold">{p.self ? `${p.display_name} (you)` : p.display_name}</span>
          {p.hand && <Hand size={15} className="text-sun" aria-label="Hand raised" />}
          {p.mic === false ? <MicOff size={15} className="text-[#FF8A7E]" aria-label="Muted" /> : <LevelMeter level={p.speaking ? 0.8 : 0.15} />}
        </li>
      ))}
    </ul>
  );
}

export function DockButton({ icon: Icon, label, onClick, active, danger, off, pressed, hint, className, ...p }) {
  return (
    <Tip label={hint}>
      <button onClick={onClick} aria-pressed={pressed} className={cn('h-14 min-w-[54px] sm:min-w-[64px] px-1.5 sm:px-2 rounded-[14px] flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors shrink-0', danger ? 'bg-coral text-white hover:brightness-110 min-w-[64px] sm:min-w-[84px]' : off ? 'bg-coral-soft text-coral-ink hover:brightness-95' : active ? 'bg-cobalt text-white' : 'bg-d2 text-dt hover:bg-d3', className)} {...p}>
        <Icon size={20} strokeWidth={1.8} />{label}
      </button>
    </Tip>
  );
}
