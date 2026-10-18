import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
/** After 3 s of waiting, explain that a free server may be waking up. */
export function ServerWakeNotice({ active }) {
  const [show, setShow] = useState(false);
  useEffect(() => { if (!active) { setShow(false); return; } const t = setTimeout(() => setShow(true), 3000); return () => clearTimeout(t); }, [active]);
  if (!show) return null;
  return <p className="mt-4 flex gap-2 text-[13px] text-ink-2 rounded-[12px] bg-surface-2 p-3" role="status"><Loader2 size={15} className="animate-spin shrink-0 mt-0.5" />Starting the server. Free hosting sleeps when idle; this can take up to a minute.</p>;
}
