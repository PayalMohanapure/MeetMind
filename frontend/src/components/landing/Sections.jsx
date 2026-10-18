import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { MonitorUp, Captions, Sparkles, ListChecks, MessageSquareQuote, ShieldCheck, Trash2, Eye, Lock, Mic } from 'lucide-react';
import { Voiceprint } from '@/components/record/Voiceprint';
import { TranscriptView } from '@/components/record/TranscriptView';
import { MinutesPanel } from '@/components/record/MinutesPanel';
import { speakersFrom } from '@/components/record/speakers';
import { VoiceAvatar } from '@/components/brand/VoiceAvatar';
import { Orb } from '@/components/brand/Orb';
import { Logo } from '@/components/brand/Logo';
import { LAUNCH_TRANSCRIPT, LAUNCH_SUMMARY } from '@/mock/data';
import { useAuth } from '@/context/AuthContext';
import { REPO_URL } from '@/config/env';

const SAMPLE_TASKS = [
  { id: 's1', title: 'Send the release notes draft', status: 'open', assignee_name: 'Rahul', due_date: null, heard_at: 755 },
  { id: 's2', title: 'Check payment gateway fees in India', status: 'open', assignee_name: 'Priya', due_date: null, heard_at: 722 },
];

export function RecordDemo() {
  const segments = useMemo(() => LAUNCH_TRANSCRIPT.map((s, i) => ({ ...s, id: `d${i}` })), []);
  const speakers = useMemo(() => speakersFrom(segments), [segments]);
  const [t, setT] = useState(180);
  const [tasks, setTasks] = useState(SAMPLE_TASKS);
  const tv = useRef(null);
  const seek = (s) => { setT(s); tv.current?.scrollTo(s); };
  return (
    <section className="mx-auto max-w-[1360px] px-4 md:px-10 py-20 md:py-24" aria-labelledby="demo-h">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-[640px]">
          <h2 id="demo-h" className="display text-[40px] md:text-[56px] leading-[1]">Inside a meeting's record.</h2>
          <p className="mt-4 text-[18px] text-ink-2">Click a chapter, a speaker lane or a "Heard at" link. Everything jumps to the moment it was said.</p>
        </div>
        <span className="badge badge-neutral h-8 px-3.5 text-[13px]">Sample meeting</span>
      </div>
      <div className="mt-10 rounded-[32px] bg-surface border border-line shadow-float p-4 md:p-7">
        <div className="rounded-[20px] border border-line p-4 md:p-5"><Voiceprint segments={segments} speakers={speakers} chapters={LAUNCH_SUMMARY.chapters} pins={tasks.map((x) => ({ start: x.heard_at, title: x.title }))} duration={1920} value={t} onSeek={seek} /></div>
        <div className="mt-5 grid lg:grid-cols-[1.45fr_1fr] gap-5">
          <TranscriptView ref={tv} segments={segments} speakers={speakers} current={t} onSeek={seek} maxHeight={480} />
          <MinutesPanel demo summary={{ ...LAUNCH_SUMMARY, chapters: [] }} tasks={tasks} onSeek={seek} onToggleTask={(x, v) => setTasks((ts) => ts.map((y) => (y.id === x.id ? { ...y, status: v ? 'done' : 'open' } : y)))} />
        </div>
      </div>
    </section>
  );
}

function Bento({ className = '', icon: Icon, title, body, children, dark }) {
  return (
    <article className={`group relative overflow-hidden rounded-[28px] p-6 md:p-7 flex flex-col ${dark ? 'dusk aurora grain text-white' : 'bg-surface border border-line'} ${className}`}>
      <div className="relative z-[1]">
        <span className={`inline-grid place-items-center h-10 w-10 rounded-[12px] ${dark ? 'bg-white/12 border border-white/15' : 'bg-cobalt-soft text-cobalt'}`}><Icon size={19} strokeWidth={1.75} /></span>
        <h3 className="mt-4 font-display text-[22px] md:text-[24px] font-bold tracking-[-0.025em] leading-tight">{title}</h3>
        <p className={`mt-2 text-[15px] max-w-[42ch] ${dark ? 'text-dt2' : 'text-ink-2'}`}>{body}</p>
      </div>
      <div className="relative z-[1] mt-6 flex-1 flex items-end">{children}</div>
    </article>
  );
}

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-[1360px] px-4 md:px-10 py-20 md:py-24 scroll-mt-20">
      <h2 className="display text-[40px] md:text-[56px] leading-[1] max-w-[16ch]">Everything a meeting leaves behind.</h2>
      <div className="mt-12 grid gap-4 md:grid-cols-6">
        <Bento dark className="md:col-span-4 min-h-[360px]" icon={MonitorUp} title="Calls in the browser, with screen share" body="Up to six people, live captions, raise hand and a muted warning when you start talking on mute.">
          <div className="grid grid-cols-3 gap-2.5 w-full">
            {[['u-asha', 'Asha Kulkarni', true], ['u-rahul', 'Rahul Deshmukh'], ['u-priya', 'Priya Nair']].map(([id, n, s]) => (
              <div key={id} className={`relative aspect-[16/10] rounded-[16px] grid place-items-center bg-d1 border-2 ${s ? 'border-sun shadow-[0_0_0_4px_rgba(255,197,61,.18)]' : 'border-transparent'}`}>
                <VoiceAvatar id={id} name={n} size={44} ring={false} />
                <span className="absolute left-2 bottom-2 rounded-[7px] bg-[rgba(14,18,44,.62)] px-2 h-6 inline-flex items-center text-[11px] font-semibold">{n.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </Bento>
        <Bento className="md:col-span-2" icon={Captions} title="Speaker-labelled transcripts" body="Every line knows who said it and when.">
          <div className="space-y-2.5 w-full">
            {[['u-asha', 'Asha', 'Then the launch date is the tenth of November.'], ['u-rahul', 'Rahul', 'Tenth works. I will block the release train.']].map(([id, n, t]) => (
              <div key={id} className="flex gap-3"><VoiceAvatar id={id} name={n} size={28} /><p className="font-record text-[15px] leading-snug"><b className="font-ui text-[12.5px] block text-ink-2">{n}</b>{t}</p></div>
            ))}
          </div>
        </Bento>
        <Bento className="md:col-span-2" icon={Sparkles} title="Minutes with decisions and chapters" body="Written a few minutes after the call ends.">
          <div className="w-full rounded-[18px] p-4 space-y-2" style={{ background: 'var(--iris-panel)' }}>
            {['Launch on 10 November', 'Pro at $9, free for students'].map((d, i) => <div key={d} className="flex gap-2.5 items-center rounded-[10px] bg-surface p-2.5"><span className="h-5 w-5 rounded-[6px] bg-iris text-white text-[11px] font-bold grid place-items-center">{i + 1}</span><span className="font-record text-[14.5px]">{d}</span></div>)}
          </div>
        </Bento>
        <Bento className="md:col-span-2" icon={ListChecks} title="Tasks that know when they were said" body="Each task links back to the second it was agreed.">
          <div className="w-full space-y-2">
            {[['Send the release notes draft', '12:35'], ['Book the launch-day demo slot', '13:10']].map(([t, h]) => <div key={t} className="flex items-center gap-3 rounded-[12px] border border-line p-3"><span className="h-5 w-5 rounded-[6px] border-[1.5px] border-line-strong" /><span className="text-[14px] font-semibold flex-1 truncate">{t}</span><span className="text-[12px] font-semibold text-cobalt shrink-0">Heard at {h}</span></div>)}
          </div>
        </Bento>
        <Bento className="md:col-span-2" icon={MessageSquareQuote} title="Ask MeetMind, with sources" body="Answers cite the meeting, the time and the speaker.">
          <div className="w-full rounded-[16px] border border-line p-3.5">
            <p className="font-record text-[15px] leading-snug">Pro is <b>$9 a month</b>, free for students <sup className="inline-grid place-items-center h-4 w-4 rounded-[5px] bg-iris text-white text-[10px] font-bold font-ui">1</sup></p>
            <p className="mt-2 rounded-[8px] bg-iris-soft px-2 py-1 text-[11.5px] text-ink-2"><b className="text-iris-ink">1</b> Launch planning 08:00 Asha</p>
          </div>
        </Bento>
      </div>
    </section>
  );
}

export function Privacy() {
  const facts = [
    [Eye, 'You only see meetings you joined.'],
    [Trash2, 'Raw audio is deleted after transcription.'],
    [ShieldCheck, "The assistant can't change anything without your confirmation."],
    [Mic, "Everyone in the call can see when it's recorded."],
  ];
  return (
    <section id="privacy" className="mx-auto max-w-[1360px] px-4 md:px-10 py-16 md:py-20 scroll-mt-20">
      <div className="rounded-[32px] bg-surface border border-line p-6 md:p-10 grid lg:grid-cols-[1fr_2fr] gap-8 items-start">
        <div>
          <span className="inline-grid place-items-center h-12 w-12 rounded-[14px] bg-ok-soft text-ok"><Lock size={22} /></span>
          <h2 className="mt-5 display text-[34px] md:text-[44px] leading-[1.02]">Private by default.</h2>
        </div>
        <ul className="grid sm:grid-cols-2 gap-3">
          {facts.map(([Icon, t]) => <li key={t} className="flex gap-3 rounded-[18px] bg-surface-2 p-5"><Icon size={20} className="text-ink-2 shrink-0 mt-0.5" strokeWidth={1.75} /><span className="text-[16px] font-semibold leading-snug">{t}</span></li>)}
        </ul>
      </div>
    </section>
  );
}

export function FinalCall() {
  const { isAuthed } = useAuth();
  return (
    <section className="px-4 md:px-10 pb-10">
      <div className="dusk aurora grain mx-auto max-w-[1360px] rounded-[40px] overflow-hidden px-6 py-16 md:py-24 text-center relative">
        <div className="relative z-[1] flex flex-col items-center">
          <Orb size={120} />
          <h2 className="mt-10 display text-white text-[40px] md:text-[64px] leading-[0.98] max-w-[16ch]">Run your next meeting on MeetMind.</h2>
          <p className="mt-4 text-dt2 text-[18px]">Free to start. Your first minutes arrive a few minutes after you hang up.</p>
          <Link to={isAuthed ? '/app' : '/register'} className="btn btn-white btn-lg mt-8">Start a meeting</Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto max-w-[1360px] px-4 md:px-10 py-10 flex flex-wrap items-center gap-x-8 gap-y-4 text-[14px] text-ink-2">
      <Logo size={24} className="!text-[17px]" />
      <a href="#how" className="hover:text-ink">How it works</a>
      <a href="#privacy" className="hover:text-ink">Privacy</a>
      {REPO_URL && <a href={REPO_URL} className="hover:text-ink" target="_blank" rel="noreferrer">How it's built</a>}
      <span className="sm:ml-auto text-ink-3">Built as a portfolio project</span>
    </footer>
  );
}
