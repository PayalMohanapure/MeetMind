import { Link } from 'react-router';
import { useEffect } from 'react';
import { Stage } from '@/components/three/Stage';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/brand/Logo';
import { useForceDaylight } from '@/context/ThemeContext';

export default function NotFound() {
  const { isAuthed } = useAuth();
  useForceDaylight();
  useEffect(() => { document.title = 'Not found · MeetMind'; }, []);
  return (
    <div className="dusk aurora grain min-h-screen flex flex-col">
      <header className="relative z-[1] p-6"><Link to="/"><Logo light /></Link></header>
      <main className="relative z-[1] flex-1 grid place-items-center px-6 pb-16 text-center">
        <div className="flex flex-col items-center">
          <Stage variant="notfound" className="h-[260px] w-[min(420px,90vw)]" />
          <p className="text-[13px] font-semibold text-dt2 tabnum">Error 404</p>
          <h1 className="display text-white text-[44px] md:text-[60px] mt-2">This meeting room is empty.</h1>
          <p className="mt-3 text-dt2 text-[17px] max-w-[44ch]">The link may be old or mistyped. Check the address, or head back.</p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            {isAuthed && <Link to="/app" className="btn btn-white btn-lg">Go to Home</Link>}
            <Link to="/" className={isAuthed ? 'btn btn-glass btn-lg' : 'btn btn-white btn-lg'}>Go to the homepage</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
