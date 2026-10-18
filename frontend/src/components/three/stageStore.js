import { create } from 'zustand';

/** Shared state between DOM (forms, buttons) and the 3D stage. Kept outside the 3D chunk so pages can import it cheaply. */
export const useStageStore = create((set) => ({
  focusSpeaker: null, // index forced to speak (e.g. while a form field is focused)
  burst: 0,           // increments → release a burst of speech particles
  error: 0,           // increments → orb flashes coral
  success: 0,         // increments → orb blooms
  hover: 0,           // increments → speaking ring pulse
  setFocusSpeaker: (i) => set({ focusSpeaker: i }),
  emitBurst: () => set((s) => ({ burst: s.burst + 1 })),
  emitError: () => set((s) => ({ error: s.error + 1 })),
  emitSuccess: () => set((s) => ({ success: s.success + 1 })),
  emitHover: () => set((s) => ({ hover: s.hover + 1 })),
}));

/** Decide whether to render WebGL at all: 0 = poster only, 2 = reduced, 3 = full. */
export function stageTier() {
  if (typeof window === 'undefined') return 0;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 0;
  if (navigator.connection?.saveData) return 0;
  if (new URLSearchParams(location.search).has('no3d') || window.__MM_NO_3D) return 0; // test / debug switch
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 0;
  } catch { return 0; }
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || window.innerWidth < 760;
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  return mobile || weak ? 2 : 3;
}
