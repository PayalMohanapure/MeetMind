import { useEffect, useRef, useState } from 'react';
import { uploadRecording } from '@/api/meetings';
import { uploadsStore } from '@/lib/uploadsStore';

const pickMime = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
// Each file must be a complete, playable recording for Whisper, so instead of timeslices
// the recorder is restarted every SEGMENT_MS (≈ 3.5 MB of opus audio, well under the 25 MB limit).
const SEGMENT_MS = 10 * 60 * 1000;

/**
 * Records the local microphone and uploads it to POST /meetings/{code}/recordings with offsetMs
 * (file start − meeting start). Failed uploads are kept in IndexedDB and retried.
 * `stop()` finishes the current file and resolves after its upload attempt, so call it
 * before ending the meeting.
 */
export function useRecorder({ code, stream, enabled, meetingStartedAt }) {
  const rec = useRef(null);
  const segStart = useRef(0);
  const index = useRef(0);
  const uploads = useRef([]);
  const stopping = useRef(false);
  const [pending, setPending] = useState(0);
  const [uploaded, setUploaded] = useState(0);
  const [lastError, setLastError] = useState(null);
  const startedAt = meetingStartedAt ? new Date(meetingStartedAt).getTime() : null;

  const send = async (blob, offset_ms, i) => {
    setPending((n) => n + 1);
    try {
      await uploadRecording(code, blob, { offset_ms });
      setUploaded((n) => n + 1);
      setLastError(null);
    } catch (e) {
      setLastError(e?.detail || e?.message || 'Upload failed');
      await uploadsStore.put(code, i, blob, { offset_ms });
    } finally {
      setPending((n) => Math.max(0, n - 1));
    }
  };

  const run = useRef(0);
  const startSegment = (track, runId) => {
    let r;
    try { r = new MediaRecorder(new MediaStream([track]), { mimeType: pickMime() || undefined, audioBitsPerSecond: 48000 }); } catch { return; }
    const parts = [];
    const offset = startedAt ? Math.max(0, Date.now() - startedAt) : 0;
    const i = index.current++;
    segStart.current = Date.now();
    const startedAtMs = segStart.current;
    r.ondataavailable = (e) => { if (e.data?.size) parts.push(e.data); };
    r.onstop = () => {
      const blob = new Blob(parts, { type: r.mimeType || 'audio/webm' });
      // ignore fragments under 1.5 s (e.g. React StrictMode's mount/unmount in development)
      if (blob.size > 0 && Date.now() - startedAtMs >= 1500) uploads.current.push(send(blob, offset, i));
      if (!stopping.current && run.current === runId && track.readyState === 'live') startSegment(track, runId);
    };
    r.start();
    rec.current = r;
  };

  useEffect(() => {
    const track = stream?.getAudioTracks()[0];
    if (!enabled || !track || !window.MediaRecorder) return;
    stopping.current = false;
    const runId = ++run.current;
    startSegment(track, runId);
    const rotate = setInterval(() => { if (rec.current?.state === 'recording') rec.current.stop(); }, SEGMENT_MS);
    const retry = setInterval(async () => {
      for (const it of await uploadsStore.pending(code)) {
        try { await uploadRecording(code, it.blob, it.meta); await uploadsStore.remove(code, it.index); setUploaded((n) => n + 1); } catch { /* keep */ }
      }
    }, 60000);
    return () => { clearInterval(rotate); clearInterval(retry); run.current += 1; if (rec.current?.state === 'recording') rec.current.stop(); };
  }, [stream, enabled, code, startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = () => new Promise((resolve) => {
    stopping.current = true;
    const r = rec.current;
    const finish = () => setTimeout(async () => { await Promise.allSettled(uploads.current); resolve(); }, 50);
    if (!r || r.state === 'inactive') return finish();
    r.addEventListener('stop', finish, { once: true });
    r.stop();
  });
  return { stop, pending, uploaded, lastError };
}
