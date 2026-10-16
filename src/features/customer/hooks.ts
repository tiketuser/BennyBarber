import { useMemo } from 'react';
import { useDb, useNow, useSession } from '@/data/store';
import { hoursFor } from '@/domain/schedule';
import type { Appointment } from '@/domain/types';
import { addDays, fmtTime, isPast, nowMinutes, relativeDayLabel, todayKey, DAY_LETTERS, weekdayOf } from '@/lib/time';

/** The signed-in customer's appointments, split into upcoming and past. */
export function useMyAppointments() {
  const db = useDb();
  const session = useSession();
  const now = useNow();
  return useMemo(() => {
    const mine = session ? db.appointments.filter((a) => a.customerPhone === session.phone && a.status === 'booked') : [];
    const upcoming: Appointment[] = [];
    const past: Appointment[] = [];
    for (const a of mine) (isPast(a.date, a.end, now) ? past : upcoming).push(a);
    upcoming.sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));
    past.sort((a, b) => (a.date === b.date ? b.start - a.start : a.date < b.date ? 1 : -1));
    const waitlist = session ? db.waitlist.filter((w) => w.customerPhone === session.phone && w.date >= todayKey(now)) : [];
    return { upcoming, past, waitlist };
  }, [db, session, now]);
}

/** "פתוח עכשיו" / "סגור • נפתח מחר ב-09:00" */
export function useOpenStatus() {
  const db = useDb();
  const now = useNow();
  return useMemo(() => {
    const today = todayKey(now);
    const t = nowMinutes(now);
    const h = hoursFor(db.settings, today);
    if (h && t >= h.from && t < h.to) return { open: true, text: 'פתוח עכשיו' };
    if (h && t < h.from) return { open: false, text: `סגור • נפתח ב-${fmtTime(h.from)}` };
    for (let d = 1; d < 14; d++) {
      const date = addDays(today, d);
      const nh = hoursFor(db.settings, date);
      if (nh) {
        const day = relativeDayLabel(date, today) ?? `ביום ${DAY_LETTERS[weekdayOf(date)]}`;
        return { open: false, text: `סגור • נפתח ${day} ב-${fmtTime(nh.from)}` };
      }
    }
    return { open: false, text: 'סגור כרגע' };
  }, [db.settings, now]);
}
