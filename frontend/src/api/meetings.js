import { api } from '@/lib/api';
import { API_URL, USE_MOCK } from '@/config/env';
import { MEETINGS, RECORDINGS, RTC, HEALTH } from './endpoints';
import { normMeeting, normTranscript, normSummary, normStatus, listOf } from './normalize';

const statusOf = (m) => m.status; // live | ended | scheduled

export async function listMeetings(f = {}) {
  const all = listOf(await api.get(MEETINGS.list, { query: { limit: 100 } })).map(normMeeting);
  let l = all;
  if (f.status && f.status !== 'all') l = l.filter((m) => statusOf(m) === f.status);
  return l;
}
export const createMeeting = async (data) => normMeeting(await api.post(MEETINGS.create, { title: data.title, recording_enabled: !!data.record }));
export const getMeeting = async (code) => normMeeting(await api.get(MEETINGS.get(code)));
export const joinMeeting = async (code) => normMeeting(await api.post(MEETINGS.join(code), {}));
export const leaveMeeting = (code) => api.post(MEETINGS.leave(code), {});
export const endMeeting = async (code) => normMeeting(await api.post(MEETINGS.end(code), {}));
export const getStatus = async (code) => normStatus(await api.get(MEETINGS.status(code)));
export const reprocess = (code) => api.post(MEETINGS.reprocess(code), {});
export const getTranscript = async (code) => normTranscript(await api.get(MEETINGS.transcript(code)));
export const getSummary = async (code) => normSummary(await api.get(MEETINGS.summary(code)));
export const getRoomChat = (code) => api.get(MEETINGS.chat(code));
export const getIceServers = async () => (RTC.iceServers ? api.get(RTC.iceServers) : null);
export const health = async () => {
  if (USE_MOCK) return api.get(HEALTH, { skipAuth: true, noRetry: true });
  const r = await fetch(`${API_URL}${HEALTH}`);
  return r.json();
};

/** One complete audio file per call (or per segment). offsetMs = file start − meeting start. */
export function uploadRecording(code, blob, { offset_ms = 0, mime = 'audio/webm' } = {}) {
  const fd = new FormData();
  const type = (blob.type || mime).split(';')[0];
  const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm';
  fd.append('file', new File([blob], `recording.${ext}`, { type }));
  fd.append('offsetMs', String(Math.max(0, Math.round(offset_ms))));
  return api.raw('POST', RECORDINGS.upload(code), { form: fd });
}
