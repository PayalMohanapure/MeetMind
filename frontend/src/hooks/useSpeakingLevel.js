import { useEffect, useState } from 'react';
let ctx;
const audioCtx = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

/** Live RMS level (0..1) of the audio track in a MediaStream. Measures even when the track is disabled? No: we read a cloned track. */
export function useSpeakingLevel(stream, { measureMuted = false } = {}) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    const track = stream?.getAudioTracks?.()[0];
    if (!track) { setLevel(0); return; }
    let raf, src, an, clone;
    try {
      const c = audioCtx();
      c.resume?.().catch(() => {});
      clone = measureMuted ? track.clone() : null;
      if (clone) clone.enabled = true;
      src = c.createMediaStreamSource(new MediaStream([clone || track]));
      an = c.createAnalyser(); an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      let last = 0;
      const loop = (t) => {
        raf = requestAnimationFrame(loop);
        if (t - last < 60) return; last = t;
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
      };
      raf = requestAnimationFrame(loop);
    } catch { /* no audio context */ }
    return () => { cancelAnimationFrame(raf); try { src?.disconnect(); } catch { /* */ } clone?.stop(); };
  }, [stream, measureMuted]);
  return level;
}
