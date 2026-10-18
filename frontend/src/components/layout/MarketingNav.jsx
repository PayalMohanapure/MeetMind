import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { REPO_URL } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

export function MarketingNav({ dark }) {
  const [scrolled, setScrolled] = useState(false);
  const { isAuthed } = useAuth();
  useEffect(() => { const f = () => setScrolled(window.scrollY > 24); f(); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f); }, []);
  const onDark = dark && !scrolled;
  return (
    <header className={cn('fixed top-0 inset-x-0 z-40 transition-all duration-200', scrolled ? 'bg-[rgba(238,241,250,.82)] backdrop-blur-xl border-b border-line' : 'bg-transparent')}>
      <nav className="mx-auto max-w-[1360px] h-[72px] px-4 md:px-10 flex items-center gap-7" aria-label="Main">
        <Link to="/" aria-label="MeetMind home"><Logo light={onDark} /></Link>
        <div className={cn('hidden md:flex items-center gap-7 text-[15px] font-semibold', onDark ? 'text-white/75' : 'text-ink-2')}>
          <a href="#how" className={onDark ? 'hover:text-white' : 'hover:text-ink'}>How it works</a>
          <a href="#features" className={onDark ? 'hover:text-white' : 'hover:text-ink'}>Features</a>
          <a href="#privacy" className={onDark ? 'hover:text-white' : 'hover:text-ink'}>Privacy</a>
          {REPO_URL && <a href={REPO_URL} target="_blank" rel="noreferrer" className={onDark ? 'hover:text-white' : 'hover:text-ink'}>GitHub</a>}
        </div>
        <div className="ml-auto flex items-center gap-2 md:gap-4">
          {isAuthed ? (
            <Link to="/app" className={cn('btn', onDark ? 'btn-white' : 'btn-primary')}>Open MeetMind</Link>
          ) : (
            <>
              <Link to="/login" className={cn('text-[15px] font-semibold px-2', onDark ? 'text-white/85 hover:text-white' : 'text-ink-2 hover:text-ink')}>Log in</Link>
              <Link to="/register" className={cn('btn', onDark ? 'btn-white' : 'btn-primary')}>Start free</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
