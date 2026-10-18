import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { VoiceAvatar } from '@/components/brand/VoiceAvatar';
import { clock } from '@/lib/format';
import { voiceInk } from '@/lib/voiceColor';
import { firstWord } from './speakers';
import { cn } from '@/lib/utils';

function highlight(text, q) {
  if (!q) return text;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  return text.split(re).map((p, i) => (i % 2 ? <mark key={i} className="bg-sun-soft text-ink rounded-[4px] px-0.5 shadow-[inset_0_-2px_0_var(--sun)]">{p}</mark> : p));
}

/** Transcript rows with search, speaker filter and deep-link flash. Ref: scrollTo(sec). */
export const TranscriptView = forwardRef(function TranscriptView({ segments = [], speakers = [], current = 0, onSeek, flashAt, maxHeight }, ref) {
  const [q, setQ] = useState('');
  const [only, setOnly] = useState(null);
  const list = useRef(null);
  const items = useMemo(() => segments.filter((s) => (!only || (s.speaker_id || s.speaker_name) === only) && (!q || s.text.toLowerCase().includes(q.toLowerCase()))), [segments, q, only]);
  const activeIdx = useMemo(() => { let k = -1; segments.forEach((s, i) => { if (s.start <= current) k = i; }); return k; }, [segments, current]);

  const scrollTo = (sec) => {
    const idx = segments.reduce((k, s, i) => (s.start <= sec + 0.5 ? i : k), 0);
    const el = list.current?.querySelector(`[data-idx="${idx}"]`);
    if (el) {
      const scroller = maxHeight ? list.current : null;
      if (scroller) scroller.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
      else el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    }
  };
  useImperativeHandle(ref, () => ({ scrollTo }));
  useEffect(() => { if (flashAt !== undefined && flashAt !== null) setTimeout(() => scrollTo(flashAt), 120); }, [flashAt, segments.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the transcript" aria-label="Search the transcript" className="input input-soft h-10 pl-10 pr-9 text-[14px]" />
          {q && <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-[8px] text-ink-3 hover:bg-surface-3" aria-label="Clear search"><X size={14} /></button>}
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Filter by speaker">
          <button onClick={() => setOnly(null)} aria-pressed={!only} className={cn('h-10 px-3 rounded-[12px] text-[13px] font-semibold border transition-colors', !only ? 'bg-ink text-surface border-ink' : 'border-line text-ink-2 hover:bg-surface-2')}>All</button>
          {speakers.map((s) => (
            <button key={s.id} onClick={() => setOnly(only === s.id ? null : s.id)} aria-pressed={only === s.id} title={`Show only ${s.name}`} className={cn('h-10 pl-1.5 pr-3 rounded-[12px] border inline-flex items-center gap-2 text-[13px] font-semibold transition-colors', only === s.id ? 'border-transparent text-white' : 'border-line text-ink-2 hover:bg-surface-2')} style={only === s.id ? { background: s.color } : undefined}>
              <VoiceAvatar id={s.id} name={s.name} size={26} ring={false} decorative />{firstWord(s.name)}
            </button>
          ))}
        </div>
      </div>
      {q && <p className="text-[13px] text-ink-2 mb-2" aria-live="polite">{items.length} {items.length === 1 ? 'match' : 'matches'}</p>}
      <ol ref={list} className={cn('relative', maxHeight && 'overflow-y-auto scroll-thin pr-1')} style={maxHeight ? { maxHeight } : undefined} aria-label="Transcript">
        {items.map((s) => {
          const idx = segments.indexOf(s);
          const active = idx === activeIdx && !q;
          const color = voiceInk(s.speaker_id || s.speaker_name);
          return (
            <li key={s.id || idx} data-idx={idx} data-start={s.start} className={cn('group relative grid grid-cols-[52px_1fr] gap-3 rounded-[14px] px-3 py-3 transition-colors', active ? 'bg-cobalt-soft/60' : 'hover:bg-surface-2')}>
              {active && <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-cobalt" />}
              <button onClick={() => onSeek?.(s.start)} className="text-[12.5px] text-ink-3 tabnum font-medium pt-0.5 text-left hover:text-cobalt" aria-label={`Jump to ${clock(s.start)}`}>{clock(s.start)}</button>
              <div className="min-w-0">
                <p className="text-[13px] font-bold mb-0.5" style={{ color }}>{firstWord(s.speaker_name)}</p>
                <p className="record-text text-ink">{highlight(s.text, q)}</p>
              </div>
            </li>
          );
        })}
        {!items.length && <li className="py-10 text-center text-ink-2">{q ? `Nothing matches "${q}". Try a shorter word.` : 'No transcript lines yet.'}</li>}
      </ol>
    </div>
  );
});
