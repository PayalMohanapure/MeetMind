import { Link } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { VoiceAvatar } from '@/components/brand/VoiceAvatar';
import { Stage } from '@/components/three/Stage';
import { useForceDaylight } from '@/context/ThemeContext';

export function AuthLayout({ children }) {
  useForceDaylight();
  return (
    <div className="min-h-screen bg-canvas grid lg:grid-cols-[minmax(440px,5fr)_7fr] lg:p-3 lg:gap-3">
      <section className="dusk aurora grain relative lg:order-2 h-[230px] lg:h-auto lg:rounded-[28px] overflow-hidden" aria-hidden="true">
        <Stage variant="auth" className="absolute inset-0" />
        <div className="hidden lg:flex absolute z-[2] left-11 right-11 bottom-10 items-end justify-between gap-6 pointer-events-none">
          <h2 className="display text-white text-[36px] leading-[1.04] max-w-[14ch] [text-shadow:0_2px_24px_rgba(20,30,110,.35)]">Talk it through. We'll keep the minutes.</h2>
          <div className="day glass rounded-[18px] px-4 py-3 shadow-float max-w-[280px]">
            <p className="flex items-center gap-2 text-[13px] font-semibold"><VoiceAvatar id="u-rahul" name="Rahul Deshmukh" size={22} ring={false} />Rahul<span className="text-ink-3 font-medium tabnum">12:40</span></p>
            <p className="mt-1 font-record text-[15px] leading-snug">I'll send the release notes to everyone by Friday.</p>
          </div>
        </div>
      </section>
      <main className="relative z-[3] -mt-6 lg:mt-0 bg-surface rounded-t-[24px] lg:rounded-[28px] lg:shadow-raise px-6 sm:px-10 lg:px-14 py-8 lg:py-10 flex flex-col min-h-[calc(100vh-206px)] lg:min-h-0">
        <Link to="/" aria-label="MeetMind home" className="self-start"><Logo /></Link>
        <div className="my-auto py-10 w-full max-w-[400px]">{children}</div>
        <div className="flex gap-5 text-[12.5px] text-ink-3"><a href="/#privacy" className="hover:text-ink">Privacy</a><span>Terms</span><span>Built as a portfolio project</span></div>
      </main>
    </div>
  );
}
