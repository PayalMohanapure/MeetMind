import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarClock, Link2, Mic, MicOff, Sparkles, CheckCircle2 } from 'lucide-react';
import { VoiceAvatar } from '@/components/brand/VoiceAvatar';
import { TallyLight, LevelMeter } from '@/components/brand/Indicators';
import { AskCard } from './Hero';
import { cn } from '@/lib/utils';

const STEPS = [
  { n: 1, title: 'Everyone speaks into their own mic.', body: 'Join from a link in the browser. Each person is recorded on their own track, so the transcript always knows who said what.' },
  { n: 2, title: 'Speech becomes a timeline.', body: 'Live captions while you talk; a speaker-labelled transcript a few minutes after the call ends.' },
  { n: 3, title: 'The timeline becomes minutes and memory.', body: 'Decisions, open questions, tasks and chapters, each linked to the exact second it was said.' },
  { n: 4, title: 'Ask, and see where the answer came from.', body: 'Ask about any meeting in plain words. Every answer cites the moment, and one click plays it back.' },
];

const people = [['u-asha', 'Asha Kulkarni'], ['u-rahul', 'Rahul Deshmukh'], ['u-priya', 'Priya Nair'], ['u-me', 'You']];

function Frame({ step }) {
  return (
    <div className="relative rounded-[28px] bg-surface border border-line shadow-float overflow-hidden h-[440px]">
      <div className="flex items-center gap-2 h-12 px-5 border-b border-line">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF8A7E]" /><span className="h-2.5 w-2.5 rounded-full bg-sun" /><span className="h-2.5 w-2.5 rounded-full bg-[#7DB52D]" />
        <span className="ml-3 text-[13px] font-semibold text-ink-2">Launch planning</span>
        <span className="ml-auto text-[12px] text-ink-3">Sample meeting</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }} className="absolute inset-x-0 top-12 bottom-0 p-5">
          {step === 0 && <Before />}
          {step === 1 && <During />}
          {step === 2 && <After />}
          {step === 3 && <div className="h-full grid place-items-center"><AskCard className="w-full max-w-[420px] !bg-surface border border-line" /></div>}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Before() {
  return (
    <div className="h-full flex flex-col justify-center gap-4 max-w-[420px] mx-auto">
      <div className="rounded-[20px] border border-line p-5">
        <p className="flex items-center gap-2 text-[13px] text-ink-2"><CalendarClock size={15} />Wednesday, 10:00</p>
        <p className="font-display text-[24px] font-bold tracking-[-0.02em] mt-1">Launch planning</p>
        <div className="mt-4 flex items-center gap-2">{people.slice(0, 3).map(([id, n]) => <VoiceAvatar key={id} id={id} name={n} size={30} />)}<span className="text-[13px] text-ink-2 ml-1">3 invited</span></div>
        <div className="mt-4 flex items-center gap-2 rounded-[12px] bg-surface-2 px-3 h-10 text-[13px]"><Link2 size={15} className="text-ink-3" /><span className="truncate text-ink-2">meetmind.app/lpn-octx-ten</span><span className="ml-auto font-semibold text-cobalt">Copy</span></div>
      </div>
      <div className="flex items-center gap-3 rounded-[16px] bg-ok-soft px-4 py-3 text-[14px] font-semibold text-ok-ink"><Mic size={16} />Camera and mic checked</div>
    </div>
  );
}

function During() {
  const [spk, setSpk] = useState(0);
  useEffect(() => { const t = setInterval(() => setSpk((s) => (s + 1) % 3), 1600); return () => clearInterval(t); }, []);
  return (
    <div className="dusk h-full rounded-[20px] p-3 flex flex-col gap-3" style={{ background: 'radial-gradient(120% 80% at 50% -10%,#232C66 0%,#141A3A 60%)' }}>
      <div className="flex items-center gap-2 text-[12px]"><span className="rounded-full border border-dl bg-d1 px-2.5 h-6 inline-flex items-center"><TallyLight className="!text-[12px] text-[#FFB3AB]" /></span><span className="rounded-full border border-dl bg-d1 px-2.5 h-6 inline-flex items-center text-dt2 tabnum">03:00</span></div>
      <div className="grid grid-cols-2 gap-2 flex-1">
        {people.map(([id, n], i) => (
          <div key={id} className={cn('relative rounded-[14px] grid place-items-center border-2 transition-all', i === spk ? 'border-sun shadow-[0_0_0_4px_rgba(255,197,61,.18)]' : 'border-transparent')} style={{ background: 'var(--d1)' }}>
            <VoiceAvatar id={id} name={n} size={46} ring={false} />
            <span className="absolute left-2 bottom-2 rounded-[7px] bg-[rgba(14,18,44,.62)] px-2 h-6 inline-flex items-center gap-1.5 text-[11px] font-semibold">{i === spk && <LevelMeter level={0.8} />}{n.split(' ')[0]}</span>
            {i === 3 && <span className="absolute right-2 top-2 h-6 w-6 rounded-[7px] bg-[rgba(14,18,44,.62)] grid place-items-center"><MicOff size={12} className="text-[#FF8A7E]" /></span>}
          </div>
        ))}
      </div>
      <p className="rounded-[12px] bg-[rgba(14,18,44,.78)] px-3 py-2 text-[14px] text-center"><b className="text-[#FFB08A]">{['Asha', 'Rahul', 'Priya'][spk]}</b> {['Then the launch date is the tenth of November.', 'I will block the release train for that week.', 'Marketing needs ten days for the post.'][spk]}</p>
    </div>
  );
}

function After() {
  return (
    <div className="h-full rounded-[20px] p-5 space-y-4" style={{ background: 'var(--iris-panel)' }}>
      <p className="flex items-center gap-2 text-[13px] font-bold text-iris-ink"><Sparkles size={15} />Minutes written by MeetMind</p>
      <p className="font-record text-[17px] leading-snug">The team set the beta launch for 10 November and agreed pricing: Pro at $9, free for students.</p>
      <div className="space-y-2">
        {['Launch date is 10 November', 'Pro plan at $9 a month, free for students'].map((d, i) => (
          <div key={d} className="flex gap-3 rounded-[12px] bg-surface p-3"><span className="h-6 w-6 rounded-[8px] bg-iris text-white grid place-items-center text-[12px] font-bold">{i + 1}</span><span className="font-record text-[15px]">{d}</span></div>
        ))}
      </div>
      <div className="flex items-center gap-3 rounded-[12px] bg-surface p-3"><CheckCircle2 size={18} className="text-ok" /><span className="text-[14px] font-semibold flex-1">Send the release notes draft</span><span className="text-[12.5px] font-semibold text-cobalt">Heard at 12:35</span></div>
    </div>
  );
}

/** Pinned lifecycle story (desktop) and stacked cards (mobile / reduced motion). */
export function Story() {
  const [step, setStep] = useState(0);
  const refs = useRef([]);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setStep(Number(e.target.dataset.step)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);
  return (
    <section id="how" className="mx-auto max-w-[1360px] px-4 md:px-10 py-20 md:py-28 scroll-mt-20">
      <div className="max-w-[720px]">
        <h2 className="display text-[40px] md:text-[56px] leading-[1]">From hello to minutes, on its own.</h2>
        <p className="mt-4 text-[18px] text-ink-2 max-w-[52ch]">You run the call. MeetMind listens, writes and remembers, so nobody has to take notes.</p>
      </div>
      <div className="mt-14 grid lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16">
        <ol className="space-y-6 lg:space-y-0">
          {STEPS.map((s, i) => (
            <li key={s.n} ref={(el) => (refs.current[i] = el)} data-step={i} className="lg:min-h-[52vh] lg:flex lg:items-center">
              <div className={cn('transition-colors duration-300', step !== i && 'lg:[&_h3]:text-ink-3 lg:[&_p]:text-ink-3')}>
                <span className={cn('inline-grid place-items-center h-10 w-10 rounded-[12px] font-display font-bold text-[18px] transition-colors', step === i ? 'bg-cobalt text-white shadow-glow' : 'bg-surface-3 text-ink-2')}>{s.n}</span>
                <h3 className="mt-4 font-display text-[28px] md:text-[34px] font-bold tracking-[-0.03em] leading-[1.08] max-w-[18ch]">{s.title}</h3>
                <p className="mt-3 text-[17px] text-ink-2 max-w-[44ch]">{s.body}</p>
                <div className="lg:hidden mt-6"><Frame step={i} /></div>
              </div>
            </li>
          ))}
        </ol>
        <div className="hidden lg:block"><div className="sticky top-[calc(50vh-220px)]"><Frame step={step} /></div></div>
      </div>
    </section>
  );
}
