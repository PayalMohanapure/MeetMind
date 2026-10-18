import { format, isToday, isYesterday, parseISO, differenceInMinutes, isThisWeek, isValid } from 'date-fns';

export const toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? parseISO(v) : new Date(v);
  return isValid(d) ? d : null;
};

/** 754 → "12:34", 3725 → "1:02:05" */
export function clock(sec = 0) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m).padStart(2, '0');
  return h ? `${h}:${mm}:${String(r).padStart(2, '0')}` : `${mm}:${String(r).padStart(2, '0')}`;
}
/** Short heard-at label: 755 → "12:35" */
export const heardAt = (sec) => clock(sec);

export function duration(sec = 0) {
  const m = Math.round(sec / 60);
  if (m < 1) return 'under 1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function spokenDuration(sec = 0) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  const mm = m ? `${m} minute${m === 1 ? '' : 's'}` : '';
  const ss = `${s} second${s === 1 ? '' : 's'}`;
  return mm ? `${mm} ${ss}` : ss;
}

export function meetingDate(v) {
  const d = toDate(v);
  if (!d) return '';
  if (isToday(d)) return `Today ${format(d, 'H:mm')}`;
  if (isYesterday(d)) return `Yesterday ${format(d, 'H:mm')}`;
  return format(d, 'EEE d MMM');
}
export const dateTime = (v) => { const d = toDate(v); return d ? format(d, "EEE d MMM, H:mm") : ''; };
export const timeOnly = (v) => { const d = toDate(v); return d ? format(d, 'H:mm') : ''; };
export const dayMonth = (v) => { const d = toDate(v); return d ? format(d, 'd MMM') : ''; };
export const minutesAgo = (v) => { const d = toDate(v); return d ? Math.max(0, differenceInMinutes(new Date(), d)) : 0; };
export const thisWeek = (v) => { const d = toDate(v); return d ? isThisWeek(d, { weekStartsOn: 1 }) : false; };

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
