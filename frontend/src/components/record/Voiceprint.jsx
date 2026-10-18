import { useMemo, useRef, useState } from 'react';
import { clock, spokenDuration } from '@/lib/format';
import { firstWord } from './speakers';
import { cn } from '@/lib/utils';

/**
 * Voiceprint: chapters on top, one lane per speaker, task pins, and a draggable playhead.
 * Works as a slider: arrows move 10 s, Home/End jump, PageUp/Down move a minute.
 */
export function Voiceprint({ segments = [], speakers = [], chapters = [], pins = [], duration, value = 0, onSeek, compact, className, dark }) {
  const track = useRef(null);
  const [hover, setHover] = useState(null);
  const total = Math.max(duration || 0, ...segments.map((s) => s.end || s.start + 10), 60);
  const pct = (t) => `${Math.min(100, Math.max(0, (t / total) * 100))}%`;
  const seekFromX = (clientX) => {
    const r = track.current.getBoundingClientRect();
    return Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * total);
  };
  const speakingAt = (t) => segments.find((s) => t >= s.start && t <= (s.end ?? s.start + 10));
  const valueText = `${spokenDuration(value)}${speakingAt(value) ? `, ${firstWord(speakingAt(value).speaker_name)} speaking` : ''}`;
  const onKey = (e) => {
    const step = { ArrowRight: 10, ArrowUp: 10, ArrowLeft: -10, ArrowDown: -10, PageUp: 60, PageDown: -60 }[e.key];
    if (step) { e.preventDefault(); onSeek?.(Math.min(total, Math.max(0, value + step))); }
    if (e.key === 'Home') { e.preventDefault(); onSeek?.(0); }
    if (e.key === 'End') { e.preventDefault(); onSeek?.(total); }
  };
  const drag = (e) => {
    if (!onSeek) return;
    onSeek(seekFromX(e.clientX));
    const move = (ev) => onSeek(seekFromX(ev.clientX));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const ticks = useMemo(() => { const step = total > 1800 ? 600 : total > 600 ? 300 : 60; return Array.from({ length: Math.floor(total / step) + 1 }, (_, i) => i * step); }, [total]);
  const laneH = compact ? 8 : 10;
  const nameW = compact ? 64 : 88;

  return (
    <div className={cn('select-none', className)}>
      {/* chapters */}
      {!!chapters.length && (
        <div className="relative h-8 mb-2" style={{ marginLeft: nameW }}>
          {chapters.map((c, i) => {
            const end = chapters[i + 1]?.start ?? total;
            const active = value >= c.start && value < end;
            return (
              <button key={i} type="button" onClick={() => onSeek?.(c.start)} className={cn('absolute top-0 h-8 border-l-2 pl-2 pr-1 text-left text-[12.5px] font-semibold truncate transition-colors', active ? 'border-cobalt text-ink' : 'border-line text-ink-2 hover:text-ink')} style={{ left: pct(c.start), width: `calc(${pct(end - c.start)} - 4px)` }} aria-label={`Chapter ${c.title} at ${clock(c.start)}`}>
                {c.title}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex">
        <div className="shrink-0 flex flex-col justify-around" style={{ width: nameW }}>
          {speakers.map((s) => <span key={s.id} className="text-[12.5px] font-bold truncate pr-2 leading-none flex items-center" style={{ color: dark ? s.color : s.ink, height: laneH + 12 }}>{firstWord(s.name)}</span>)}
        </div>
        <div
          ref={track}
          role="slider" tabIndex={0} aria-label="Meeting timeline" aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={Math.round(value)} aria-valuetext={valueText}
          onKeyDown={onKey} onPointerDown={drag}
          onPointerMove={(e) => setHover(seekFromX(e.clientX))} onPointerLeave={() => setHover(null)}
          className="relative flex-1 cursor-pointer rounded-[8px] focus-visible:shadow-[var(--focus)]"
        >
          {speakers.map((s) => (
            <div key={s.id} className="relative" style={{ height: laneH + 12 }}>
              <div className={cn('absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full', dark ? 'bg-white/8' : 'bg-surface-2')} style={{ height: laneH }} />
              {segments.filter((g) => (g.speaker_id || g.speaker_name) === s.id).map((g, i) => (
                <div key={i} className="absolute top-1/2 -translate-y-1/2 rounded-full" style={{ left: pct(g.start), width: `max(6px, ${pct((g.end ?? g.start + 10) - g.start)})`, height: laneH, background: s.color, opacity: value >= g.start && value <= (g.end ?? g.start + 10) ? 1 : 0.88 }} />
              ))}
            </div>
          ))}
          {pins.map((p, i) => (
            <span key={i} title={`${p.title} · ${clock(p.start)}`} className="absolute -top-1.5 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-sun shadow-[0_0_0_2px_var(--surface)] pointer-events-none" style={{ left: `calc(${pct(p.start)} - 5px)` }} />
          ))}
          {hover !== null && <span className="absolute top-0 bottom-0 w-px bg-ink-3/40 pointer-events-none" style={{ left: pct(hover) }}><span className="absolute -top-7 -translate-x-1/2 rounded-[6px] bg-[#1A2042] px-1.5 py-0.5 text-[11px] font-semibold text-white tabnum">{clock(hover)}</span></span>}
          <span className={cn('absolute -top-1 -bottom-1 w-[2px] rounded-full pointer-events-none', dark ? 'bg-white' : 'bg-ink')} style={{ left: pct(value) }}>
            <span className={cn('absolute -top-1 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full', dark ? 'bg-white' : 'bg-ink')} />
          </span>
        </div>
      </div>
      {!compact && (
        <div className="relative h-5 mt-1 text-[11px] text-ink-3 tabnum" style={{ marginLeft: nameW }}>
          {ticks.map((t) => <span key={t} className="absolute -translate-x-1/2" style={{ left: pct(t) }}>{clock(t)}</span>)}
        </div>
      )}
    </div>
  );
}
