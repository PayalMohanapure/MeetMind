import { cn } from '@/lib/utils';

/**
 * CSS "MeetMind orb": the brand's signature object without WebGL.
 * Used on Home, empty states, the 404 page and as the 3D poster fallback.
 */
export function Orb({ size = 160, className, still, intensity = 1 }) {
  return (
    <span className={cn('relative inline-block shrink-0', className)} style={{ width: size, height: size }} aria-hidden="true">
      <span className="absolute -inset-[35%] rounded-full blur-2xl" style={{ background: 'radial-gradient(circle, rgba(115,87,246,.55) 0%, rgba(49,80,255,.25) 40%, transparent 70%)', opacity: 0.9 * intensity }} />
      <span className="absolute inset-0 rounded-full overflow-hidden" style={{ boxShadow: 'inset 0 -12px 30px rgba(20,26,90,.45), inset 0 8px 20px rgba(255,255,255,.35), 0 20px 50px -18px rgba(30,40,140,.7)' }}>
        <span className={cn('absolute -inset-[30%]', !still && 'animate-[orb-spin_14s_linear_infinite]')} style={{ background: 'conic-gradient(from 0deg, #4C6FFF, #7357F6, #E255A1, #FFB45C, #FFC53D, #4C6FFF)', filter: 'blur(14px)' }} />
        <span className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 115%, rgba(20,26,90,.55), transparent 55%)' }} />
        <span className="absolute inset-0" style={{ background: 'radial-gradient(circle at 32% 26%, rgba(255,255,255,.95) 0%, rgba(255,255,255,.35) 14%, transparent 34%)' }} />
        <span className="absolute inset-0 rounded-full" style={{ border: '1px solid rgba(255,255,255,.45)' }} />
      </span>
    </span>
  );
}
