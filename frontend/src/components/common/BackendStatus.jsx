import { useEffect, useState } from 'react';
import { AlertTriangle, FlaskConical, RotateCw } from 'lucide-react';
import { API_URL, USE_MOCK } from '@/config/env';

/** Always shows where data goes: a badge in demo mode, a red bar if the FastAPI server is down. */
export function BackendStatus() {
  const [state, setState] = useState('ok'); // ok | down | nodb
  const [checking, setChecking] = useState(false);
  const check = async () => {
    setChecking(true);
    try {
      const r = await fetch(`${API_URL}/health`);
      const j = await r.json().catch(() => ({}));
      setState(j.database && j.database !== 'ok' ? 'nodb' : 'ok');
    } catch { setState('down'); }
    setChecking(false);
  };
  useEffect(() => { if (!USE_MOCK) check(); }, []);

  if (USE_MOCK) {
    return (
      <div data-testid="mock-mode" role="status" className="pointer-events-none fixed left-1/2 -translate-x-1/2 top-2 z-[70] inline-flex items-center gap-2 rounded-full bg-sun text-[#1A2042] px-3.5 h-7 text-[12px] font-semibold shadow-float whitespace-nowrap">
        <FlaskConical size={14} />Demo mode: nothing is saved to your database
      </div>
    );
  }
  if (state === 'ok') return null;
  return (
    <div role="alert" data-testid="backend-down" className="fixed inset-x-0 top-0 z-[70] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-coral text-white px-4 py-2 text-[13.5px] font-semibold">
      <AlertTriangle size={16} />
      <span>{state === 'down'
        ? `Can't reach the backend at ${API_URL}. Start it with: uvicorn app.main:app --reload --port 8000`
        : 'The backend is running but cannot reach PostgreSQL. Check DATABASE_URL in backend/.env.'}</span>
      <button onClick={check} className="inline-flex items-center gap-1.5 rounded-[8px] bg-white/20 px-2.5 h-7 hover:bg-white/30"><RotateCw size={13} className={checking ? 'animate-spin' : ''} />Retry</button>
    </div>
  );
}
