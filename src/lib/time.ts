import type { DateKey, Minutes, Weekday } from '@/domain/types';

export const DAY_LETTERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'] as const;

export const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'] as const;
export const MONTHS_SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'] as const;

const pad = (n: number) => (n < 10 ? '0' : '') + n;

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(now = new Date()): DateKey {
  return toKey(now);
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

export function weekdayOf(key: DateKey): Weekday {
  return fromKey(key).getDay() as Weekday;
}

export function nowMinutes(now = new Date()): Minutes {
  return now.getHours() * 60 + now.getMinutes();
}

/** 1050 -> "17:30" */
export function fmtTime(m: Minutes): string {
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/**
 * Wraps text in a left-to-right isolate. Without it, "17:30 - 18:15" inside Hebrew text
 * is laid out right-to-left and reads "18:15 - 17:30".
 */
const ltr = (s: string) => `⁦${s}⁩`;

/** "17:30 - 18:15", safe to drop into Hebrew text. */
export function fmtRange(from: Minutes, to: Minutes): string {
  return ltr(`${fmtTime(from)} - ${fmtTime(to)}`);
}

/** "20.10" */
export function fmtDayMonth(key: DateKey): string {
  const d = fromKey(key);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

/** "20.10 - 24.10", safe to drop into Hebrew text. */
export function fmtDayMonthRange(from: DateKey, to: DateKey): string {
  return ltr(`${fmtDayMonth(from)} - ${fmtDayMonth(to)}`);
}

/** "יום ג׳, 20.10" */
export function fmtShortDate(key: DateKey): string {
  return `יום ${DAY_LETTERS[weekdayOf(key)]}, ${fmtDayMonth(key)}`;
}

/** "יום ו׳, 16 באוקטובר" */
export function fmtLongDate(key: DateKey): string {
  const d = fromKey(key);
  return `יום ${DAY_LETTERS[d.getDay()]}, ${d.getDate()} ב${MONTHS[d.getMonth()]}`;
}

/** "20 באוק׳" */
export function fmtDayShortMonth(key: DateKey): string {
  const d = fromKey(key);
  return `${d.getDate()} ב${MONTHS_SHORT[d.getMonth()]}`;
}

export function relativeDayLabel(key: DateKey, today: DateKey): string | null {
  if (key === today) return 'היום';
  if (key === addDays(today, 1)) return 'מחר';
  return null;
}

/** "לפני 2 דק׳" style relative time for recent events. */
export function fmtAgo(ts: number, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - ts) / 60000));
  if (min < 1) return 'עכשיו';
  if (min < 60) return `לפני ${min} דק׳`;
  const h = Math.round(min / 60);
  if (h < 24) return h === 1 ? 'לפני שעה' : `לפני ${h} שעות`;
  const d = Math.round(h / 24);
  return d === 1 ? 'אתמול' : `לפני ${d} ימים`;
}

export function monthKey(key: DateKey): string {
  return key.slice(0, 7);
}

export function isPast(date: DateKey, end: Minutes, now = new Date()): boolean {
  const today = todayKey(now);
  return date < today || (date === today && end <= nowMinutes(now));
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'בוקר טוב';
  if (h < 17) return 'צהריים טובים';
  if (h < 21) return 'ערב טוב';
  return 'לילה טוב';
}
