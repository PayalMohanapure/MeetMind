import { useCallback, useEffect, useRef, useState } from 'react';
import { storage } from '@/lib/utils';

export const devicePrefs = {
  get: () => storage.get('mm-devices', { camera: '', mic: '', speaker: '', mirror: true, noiseSuppression: true, joinMuted: false, joinCamOff: false }),
  set: (p) => storage.set('mm-devices', { ...devicePrefs.get(), ...p }),
};

/** Local camera + mic preview with device selection and permission handling. */
export function useLocalMedia({ auto = true } = {}) {
  const prefs = devicePrefs.get();
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null); // 'denied' | 'notfound' | 'other'
  const [devices, setDevices] = useState({ cameras: [], mics: [], speakers: [] });
  const [mic, setMic] = useState(!prefs.joinMuted);
  const [cam, setCam] = useState(!prefs.joinCamOff);
  const [sel, setSel] = useState({ camera: prefs.camera, mic: prefs.mic, speaker: prefs.speaker });
  const [noise, setNoise] = useState(prefs.noiseSuppression);
  const streamRef = useRef(null);

  const enumerate = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices({ cameras: list.filter((d) => d.kind === 'videoinput'), mics: list.filter((d) => d.kind === 'audioinput'), speakers: list.filter((d) => d.kind === 'audiooutput') });
    } catch { /* */ }
  }, []);

  const start = useCallback(async (opts = {}) => {
    const s = { ...sel, ...opts };
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (!navigator.mediaDevices?.getUserMedia) { setError('other'); return null; }
    try {
      const st = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: s.camera ? { exact: s.camera } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { deviceId: s.mic ? { exact: s.mic } : undefined, noiseSuppression: opts.noise ?? noise, echoCancellation: true, autoGainControl: true },
      });
      st.getAudioTracks().forEach((t) => (t.enabled = mic));
      st.getVideoTracks().forEach((t) => (t.enabled = cam));
      streamRef.current = st; setStream(st); setError(null);
      enumerate();
      return st;
    } catch (e) {
      // Fall back to audio only if the camera is missing or busy.
      if (e.name === 'NotFoundError' || e.name === 'NotReadableError' || e.name === 'OverconstrainedError') {
        try {
          const st = await navigator.mediaDevices.getUserMedia({ audio: true });
          st.getAudioTracks().forEach((t) => (t.enabled = mic));
          streamRef.current = st; setStream(st); setCam(false); setError(null); enumerate();
          return st;
        } catch { /* fallthrough */ }
      }
      setError(e.name === 'NotAllowedError' || e.name === 'SecurityError' ? 'denied' : e.name === 'NotFoundError' ? 'notfound' : 'other');
      return null;
    }
  }, [sel, mic, cam, noise, enumerate]);

  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    if (auto && !streamRef.current) start();
    return () => {
      mounted.current = false;
      // stop on real unmount only (StrictMode runs this cleanup once in development)
      setTimeout(() => { if (!mounted.current) streamRef.current?.getTracks().forEach((t) => t.stop()); }, 0);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = mic)); }, [mic, stream]);
  useEffect(() => { streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = cam)); }, [cam, stream]);

  const choose = (kind, id) => {
    setSel((s) => ({ ...s, [kind]: id }));
    devicePrefs.set({ [kind]: id });
    if (kind !== 'speaker') start({ [kind]: id });
  };
  const setNoiseSuppression = (v) => { setNoise(v); devicePrefs.set({ noiseSuppression: v }); start({ noise: v }); };
  const release = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setStream(null); };
  const hasVideo = !!stream?.getVideoTracks().length;

  return { stream, error, devices, mic, setMic, camWanted: cam, cam: cam && hasVideo, setCam, hasVideo, sel, choose, noise, setNoiseSuppression, retry: () => start(), release, streamRef };
}
