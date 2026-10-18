import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Play, ArrowDown } from 'lucide-react';
import { Stage } from '@/components/three/Stage';
import { useStageStore } from '@/components/three/stageStore';
import { useAuth } from '@/context/AuthContext';
import { features } from '@/config/features';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
import { useState } from 'react';

const rise = (d) => ({ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay: d, ease: [0.2, 0.8, 0.2, 1] } });

function DecisionsCard() {
  return (
    <motion.div {...rise(1.1)} className="absolute right-5 top-5 md:right-7 md:top-7 z-10 day w-[250px] rounded-[20px] glass p-4 shadow-float hidden md:block">
      <p className="flex items-center gap-2 text-[12px] font-bold text-iris-ink"><span className="badge badge-ai h-5 px-1.5 text-[10px]">AI</span>Decisions</p>
      <ul className="mt-2 space-y-1.5 font-record text-[14.5px] text-ink leading-snug">
        <li className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-iris shrink-0" />Launch on 10 November</li>
        <li className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-iris shrink-0" />Pro at $9, free for students</li>
      </ul>
    </motion.div>
  );
}

export function AskCard({ className = '' }) {
  return (
    <div className={`day rounded-[22px] glass p-4 shadow-float ${className}`}>
      <div className="flex justify-end"><span className="rounded-[14px] rounded-br-[4px] bg-cobalt text-white px-3 py-2 text-[14px] font-semibold">What did we decide about the launch date?</span></div>
      <p className="mt-3 font-record text-[16px] leading-[1.5] text-ink">
        The launch is on <b>10 November</b>, after a feature freeze this Friday <sup className="inline-grid place-items-center h-[18px] w-[18px] rounded-[6px] bg-iris text-white text-[11px] font-bold align-[2px] font-ui">1</sup>
      </p>
      <div className="mt-2.5 flex items-center gap-2 rounded-[10px] bg-iris-soft px-2.5 py-1.5 text-[12px] text-ink-2">
        <b className="text-iris-ink">1</b><span className="font-semibold text-ink">Launch planning</span><span className="tabnum">03:00</span><span>Asha</span>
      </div>
    </div>
  );
}

export function Hero() {
  const { isAuthed, demo } = useAuth();
  const nav = useNavigate();
  const emitHover = useStageStore((s) => s.emitHover);
  const [busy, setBusy] = useState(false);
  const tryDemo = async () => {
    setBusy(true);
    try { await demo(); nav('/app/meetings/lpn-octx-ten'); } catch (e) { toast(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <section className="dusk relative overflow-hidden aurora grain rounded-b-[40px] md:rounded-b-[56px]">
      <div className="relative z-[1] mx-auto max-w-[1360px] px-4 md:px-10 pt-[96px] md:pt-[104px] pb-10 md:pb-20 grid lg:grid-cols-[5fr_7fr] gap-8 lg:gap-6 items-center min-h-[min(100svh,980px)]">
        <div className="lg:pb-10">
          <motion.h1 {...rise(0.05)} className="display text-white text-[52px] sm:text-[64px] lg:text-[clamp(56px,6.2vw,92px)] leading-[0.94] tracking-[-0.045em]" style={{ fontVariationSettings: '"wdth" 85' }}>
            Meetings that write their own minutes.
          </motion.h1>
          <motion.p {...rise(0.2)} className="mt-6 text-[18px] md:text-[20px] leading-[1.5] text-dt2 max-w-[32ch]">
            Video calls that turn into a speaker-labelled transcript, clear minutes, and answers that link to the moment someone said it.
          </motion.p>
          <motion.div {...rise(0.32)} className="mt-8 flex flex-wrap gap-3">
            <Link to={isAuthed ? '/app' : '/register'} onMouseEnter={emitHover} onFocus={emitHover} className="btn btn-white btn-lg">Start a meeting</Link>
            {features.demo && <button onClick={tryDemo} disabled={busy} className="btn btn-glass btn-lg"><Play size={16} fill="currentColor" />{busy ? 'Opening demo…' : 'Try the live demo'}</button>}
          </motion.div>
          <motion.p {...rise(0.42)} className="mt-5 text-[14px] text-white/55">Works in the browser. Nothing to install.</motion.p>
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }} className="relative">
          <Stage variant="hero" className="h-[340px] sm:h-[460px] lg:h-[640px] rounded-[32px]">
            <DecisionsCard />
            <motion.div {...rise(1.3)} className="absolute left-4 bottom-4 md:left-6 md:bottom-6 z-10 w-[min(360px,calc(100%-32px))] hidden sm:block"><AskCard /></motion.div>
          </Stage>
          <div className="sm:hidden mt-3"><AskCard /></div>
        </motion.div>
      </div>
      <a href="#how" className="hidden lg:flex absolute left-1/2 -translate-x-1/2 bottom-6 z-[1] items-center gap-2 text-[13px] font-semibold text-white/55 hover:text-white">See how it works<ArrowDown size={14} /></a>
    </section>
  );
}
