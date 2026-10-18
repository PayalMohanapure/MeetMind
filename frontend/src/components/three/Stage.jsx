import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Orb } from '@/components/brand/Orb';
import { stageTier } from './stageStore';
import { cn } from '@/lib/utils';

const OrbScene = lazy(() => import('./OrbScene'));

/** Poster shown before WebGL loads, and instead of it on weak devices / reduced motion. */
function Poster({ variant }) {
  const tiles = variant !== 'hero' && variant !== 'auth' ? [] : [
    { c: '#4C6FFF', i: 'AK', x: '14%', y: '30%', r: -6 },
    { c: '#FF8A3D', i: 'RD', x: '72%', y: '22%', r: 5 },
    { c: '#E255A1', i: 'PN', x: '78%', y: '62%', r: 7 },
    { c: '#7DB52D', i: 'SS', x: '10%', y: '64%', r: -4 },
  ];
  return (
    <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
      <Orb size={{ auth: 190, hero: 230, mini: 110, minutes: 150, notfound: 150 }[variant] || 200} intensity={1.1} still={variant === 'notfound'} className={variant === 'notfound' ? 'opacity-70 saturate-50' : ''} />
      {tiles.map((t) => (
        <span key={t.i} className="absolute w-[86px] h-[56px] rounded-[10px] border-[3px] border-white shadow-float grid place-items-center" style={{ left: t.x, top: t.y, transform: `rotate(${t.r}deg)`, background: `linear-gradient(135deg, ${t.c}AA, ${t.c})` }}>
          <span className="w-7 h-7 rounded-[9px] bg-white grid place-items-center font-display font-bold text-[11px]" style={{ color: t.c }}>{t.i}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Lazy 3D stage: renders the poster immediately, loads the WebGL chunk when the browser is idle,
 * fades the canvas in after its first frame, and pauses rendering when off-screen or hidden.
 */
export function Stage({ variant = 'hero', className, children }) {
  const host = useRef(null);
  const [tier] = useState(() => stageTier());
  const [load, setLoad] = useState(false);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!tier) return;
    const go = () => setLoad(true);
    const id = 'requestIdleCallback' in window ? window.requestIdleCallback(go, { timeout: 1200 }) : setTimeout(go, 300);
    return () => ('cancelIdleCallback' in window ? window.cancelIdleCallback(id) : clearTimeout(id));
  }, [tier]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let visible = true;
    const upd = () => setActive(visible && !document.hidden);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; upd(); }, { threshold: 0.01 });
    io.observe(el);
    document.addEventListener('visibilitychange', upd);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', upd); };
  }, []);

  return (
    <div ref={host} className={cn(/\b(absolute|fixed)\b/.test(className || '') ? '' : 'relative', 'overflow-hidden', className)} data-stage={variant} data-stage-ready={ready ? 'true' : 'false'}>
      <div className={cn('absolute inset-0 transition-opacity duration-700', ready ? 'opacity-0' : 'opacity-100')}><Poster variant={variant} /></div>
      {load && (
        <div className={cn('absolute inset-0 transition-opacity duration-700', ready ? 'opacity-100' : 'opacity-0')}>
          <Suspense fallback={null}>
            <OrbScene variant={variant} quality={tier} active={active} onReady={() => setReady(true)} />
          </Suspense>
        </div>
      )}
      {children}
    </div>
  );
}
