import { Sparkles, ListChecks, HelpCircle, CheckCircle2, Users } from 'lucide-react';
import { VoiceAvatar } from '@/components/brand/VoiceAvatar';
import { duration } from '@/lib/format';
import { firstWord } from './speakers';

/** The "at a glance" band at the top of a meeting record: AI summary + talk time. */
export function SummaryHero({ summary, speakers = [], counts = {} }) {
  const stats = [
    { icon: CheckCircle2, n: counts.decisions ?? 0, label: 'Decisions' },
    { icon: ListChecks, n: counts.tasks ?? 0, label: 'Tasks' },
    { icon: HelpCircle, n: counts.questions ?? 0, label: counts.questionsLabel || 'Open questions' },
    { icon: Users, n: speakers.length, label: 'Speakers' },
  ];
  return (
    <section className="relative overflow-hidden rounded-[26px] aurora-card grain text-white p-6 md:p-8 shadow-float" aria-label="Summary">
      <div className="relative z-[1] grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/20 px-3 h-7 text-[12.5px] font-semibold backdrop-blur"><Sparkles size={14} />Summary written by MeetMind</p>
          <p className="mt-4 font-record text-[20px] md:text-[22px] leading-[1.5] max-w-[60ch] text-white">{summary}</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {stats.map(({ icon: Icon, n, label }) => (
              <li key={label} className="inline-flex items-center gap-2 h-9 rounded-[12px] bg-white/12 border border-white/18 px-3 text-[13px] font-semibold backdrop-blur">
                <Icon size={15} className="opacity-90" /><span className="tabnum text-[15px]">{n}</span><span className="text-white/80 font-medium">{label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[20px] bg-[rgba(20,26,90,.28)] border border-white/15 p-5 backdrop-blur">
          <p className="text-[13px] font-semibold text-white/80 mb-4">Who talked how much</p>
          <ul className="space-y-3.5">
            {speakers.map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                <VoiceAvatar id={s.id} name={s.name} size={30} ring={false} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-[13px] font-semibold mb-1.5"><span>{firstWord(s.name)}</span><span className="tabnum text-white/80">{Math.round(s.share * 100)}%<span className="sr-only">, {duration(s.seconds)}</span></span></div>
                  <div className="h-1.5 rounded-full bg-white/15 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(4, s.share * 100)}%`, background: s.color, boxShadow: `0 0 12px ${s.color}` }} /></div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
