import { useEffect, useRef } from 'react';
/** map: { 'm': fn, 'mod+k': fn, '?': fn }. Ignores keys while typing unless allowInInputs. */
export function useHotkeys(map, { enabled = true, allowInInputs = [] } = {}) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    if (!enabled) return;
    const h = (e) => {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable || t.tagName === 'SELECT');
      const key = `${e.metaKey || e.ctrlKey ? 'mod+' : ''}${e.key.toLowerCase()}`;
      const fn = ref.current[key];
      if (!fn) return;
      if (typing && !allowInInputs.includes(key)) return;
      if (!key.startsWith('mod+') && (e.altKey || e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      fn(e);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
