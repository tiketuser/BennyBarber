// Pure scheduling rules, shared by every backend implementation and the UI.
import type { Appointment, Block, DateKey, DayHours, DayPart, DbSnapshot, Minutes, Settings, Vacation } from './types';
import { addDays, addMonths, daysBetween, fmtShortDate, isPast, nowMinutes, todayKey, weekdayOf } from '@/lib/time';
import { SHOP, g } from '@/config/shop';

const SLOT_STEP = 30;
export const PARTS: { id: Exclude<DayPart, 'any'>; label: string; from: Minutes; to: Minutes }[] = [
  { id: 'morning', label: 'בוקר', from: 0, to: 12 * 60 },
  { id: 'noon', label: 'צהריים', from: 12 * 60, to: 16 * 60 },
  { id: 'evening', label: 'ערב', from: 16 * 60, to: 24 * 60 },
];
export const PART_LABELS: Record<DayPart, string> = { morning: 'בוקר', noon: 'צהריים', evening: 'ערב', any: 'כל שעה' };

export function partOf(m: Minutes): Exclude<DayPart, 'any'> {
  return m < 12 * 60 ? 'morning' : m < 16 * 60 ? 'noon' : 'evening';
}

function isVacation(settings: Settings, date: DateKey): boolean {
  return settings.vacations.some((v) => date >= v.from && date <= v.to);
}

/** The first day the shop opens again after a vacation (null if nothing within two months). */
export function backFrom(settings: Settings, v: Vacation): DateKey | null {
  for (let d = addDays(v.to, 1), i = 0; i < 60; d = addDays(d, 1), i++) if (hoursFor(settings, d)) return d;
  return null;
}

/** "בחופשה עד יום ו׳, 24.10. חוזרים ביום א׳, 25.10" */
export function vacationText(settings: Settings, v: Vacation): string {
  const back = backFrom(settings, v);
  return `בחופשה עד ${fmtShortDate(v.to)}` + (back ? `. חוזרים ב${fmtShortDate(back)}` : '');
}

/** Why a day has no hours: the vacation and when he's back, or the plain weekly closed day. */
export function closedText(settings: Settings, date: DateKey): string {
  const v = settings.vacations.find((x) => date >= x.from && date <= x.to);
  return v ? vacationText(settings, v) : `${SHOP.closed} ביום הזה`;
}

/** A vacation going on now or starting within two weeks, to tell customers ahead. */
export function upcomingVacation(settings: Settings, today: DateKey): Vacation | null {
  const soon = addDays(today, 14);
  return settings.vacations.filter((v) => v.to >= today && v.from <= soon).sort((a, b) => (a.from < b.from ? -1 : 1))[0] ?? null;
}

/** Opening hours for a date, or null when the shop is closed (weekly off day or vacation). */
export function hoursFor(settings: Settings, date: DateKey): DayHours | null {
  if (isVacation(settings, date)) return null;
  const h = settings.hours[weekdayOf(date)];
  return h.open ? h : null;
}

type Busy = { from: Minutes; to: Minutes; kind: 'appointment' | 'block' | 'break'; ref?: Appointment | Block };

export function busyFor(db: Pick<DbSnapshot, 'appointments' | 'blocks' | 'settings'>, date: DateKey): Busy[] {
  const out: Busy[] = [];
  for (const a of db.appointments) {
    if (a.date === date && a.status === 'booked') out.push({ from: a.start, to: a.end, kind: 'appointment', ref: a });
  }
  for (const b of db.blocks) {
    if (b.date === date) out.push({ from: b.start, to: b.end, kind: 'block', ref: b });
  }
  const h = hoursFor(db.settings, date);
  const br = db.settings.breakTime;
  if (h && br && br.from < h.to && br.to > h.from) out.push({ from: br.from, to: br.to, kind: 'break' });
  return out.sort((x, y) => x.from - y.from);
}

const overlaps = (a: Minutes, b: Minutes, busy: Busy[]) => busy.some((x) => a < x.to && b > x.from);

/** True when start-end runs into an appointment, block or break that day. */
export function clashes(db: Pick<DbSnapshot, 'appointments' | 'blocks' | 'settings'>, date: DateKey, start: Minutes, end: Minutes): boolean {
  return overlaps(start, end, busyFor(db, date));
}

interface SlotView {
  start: Minutes;
  available: boolean;
}

/**
 * Bookable start times for a service on a date.
 * Candidates are the 30-minute grid plus the moment each appointment ends,
 * so a 45-minute booking at 09:00 still leaves 09:45 open instead of wasting 15 minutes.
 */
export function slotsFor(db: DbSnapshot, date: DateKey, durationMin: number, now = new Date()): SlotView[] {
  const h = hoursFor(db.settings, date);
  if (!h) return [];
  const busy = busyFor(db, date);
  const minStart = date === todayKey(now) ? nowMinutes(now) + 10 : -1;
  const candidates = new Set<number>();
  for (let t = h.from; t + durationMin <= h.to; t += SLOT_STEP) candidates.add(t);
  for (const b of busy) if (b.to % 15 === 0 && b.to + durationMin <= h.to && b.to % SLOT_STEP !== 0) candidates.add(b.to);
  return (
    [...candidates]
      .sort((a, b) => a - b)
      .filter((t) => t >= minStart)
      .map((start) => ({ start, available: !overlaps(start, start + durationMin, busy) }))
      // Off-grid candidates are only worth showing when they are actually free.
      .filter((s) => s.start % SLOT_STEP === 0 || s.available)
  );
}

export type DayStatus = 'open' | 'closed' | 'vacation' | 'full' | 'almost-full';

export function dayStatus(db: DbSnapshot, date: DateKey, durationMin: number, now = new Date()): DayStatus {
  if (isVacation(db.settings, date)) return 'vacation';
  if (!hoursFor(db.settings, date)) return 'closed';
  const slots = slotsFor(db, date, durationMin, now);
  // Today after the last possible start: the day is over, not full (no point in a waitlist).
  if (slots.length === 0) return 'closed';
  const free = slots.filter((s) => s.available).length;
  if (free === 0) return 'full';
  if (free <= 2) return 'almost-full';
  return 'open';
}

interface Gap {
  from: Minutes;
  to: Minutes;
}

/** Free windows inside opening hours (from now on, for today), at least `minLen` minutes long. */
export function freeGaps(db: DbSnapshot, date: DateKey, minLen = 20, now = new Date()): Gap[] {
  const h = hoursFor(db.settings, date);
  if (!h) return [];
  let cursor = h.from;
  if (date === todayKey(now)) {
    const n = nowMinutes(now);
    cursor = Math.max(cursor, Math.ceil(n / 5) * 5);
  } else if (date < todayKey(now)) {
    return [];
  }
  const gaps: Gap[] = [];
  for (const b of busyFor(db, date)) {
    if (b.from > cursor) gaps.push({ from: cursor, to: Math.min(b.from, h.to) });
    cursor = Math.max(cursor, b.to);
  }
  if (cursor < h.to) gaps.push({ from: cursor, to: h.to });
  return gaps.filter((g) => g.to - g.from >= minLen);
}

/** Start of the first free window (from now on, for today) that fits `len` minutes, or null. */
export function nextFreeStart(db: DbSnapshot, date: DateKey, len: number, now = new Date()): Minutes | null {
  for (const g of freeGaps(db, date, len, now)) return g.from;
  return null;
}

/** Throws a user-facing Hebrew message when a booking can't be placed. */
export function assertBookable(
  db: DbSnapshot,
  date: DateKey,
  start: Minutes,
  end: Minutes,
  opts: { ignoreId?: string; now?: Date; allowPast?: boolean; allowOverlap?: boolean } = {},
) {
  const { ignoreId, now = new Date(), allowPast = false, allowOverlap = false } = opts;
  const h = hoursFor(db.settings, date);
  if (!h) throw new Error(closedText(db.settings, date));
  if (!allowPast && isPast(date, start + 1, now)) throw new Error(`השעה הזו כבר עברה, ${g('בחר', 'בחרי', 'בחרו')} שעה אחרת`);
  if (start < h.from || end > h.to) throw new Error('השעה מחוץ לשעות הפתיחה');
  const busy = busyFor(db, date).filter((b) => !(b.kind === 'appointment' && b.ref?.id === ignoreId));
  if (!allowOverlap && overlaps(start, end, busy)) throw new Error(`השעה הזו כבר נתפסה, ${g('בחר', 'בחרי', 'בחרו')} שעה אחרת`);
}

/** The days a customer can book: today through `months` months ahead. */
export function bookingDays(today: DateKey, months: number): DateKey[] {
  return daysBetween(today, addMonths(today, months));
}

/** Customers book up to `months` ahead; the admin is not limited. */
export function assertWithinBookingWindow(date: DateKey, months: number, now = new Date()) {
  if (date > addMonths(todayKey(now), months)) throw new Error(`אפשר לקבוע תור עד ${months === 1 ? 'חודש' : months + ' חודשים'} קדימה`);
}
