import { useMemo } from 'react';
import { useDb, useNow } from '@/data/store';
import { busyFor, partOf } from '@/domain/schedule';
import type { Appointment, DbSnapshot } from '@/domain/types';
import { isPast, todayKey } from '@/lib/time';

/** Recent cancellations whose slot is still free and that have people waiting for that day. */
export function useOpenings(): Appointment[] {
  const db = useDb();
  const now = useNow();
  return useMemo(() => findOpenings(db, now), [db, now]);
}

function findOpenings(db: DbSnapshot, now: Date) {
  const today = todayKey(now);
  return db.appointments
    .filter((a) => a.status === 'cancelled' && a.openingHandled === false && a.date >= today && !isPast(a.date, a.end, now))
    .filter((a) => !busyFor(db, a.date).some((b) => a.start < b.to && a.end > b.from))
    .filter((a) => waitingFor(db, a).length > 0)
    .sort((a, b) => (b.cancelledAt ?? 0) - (a.cancelledAt ?? 0));
}

export function waitingFor(db: DbSnapshot, a: Appointment) {
  const part = partOf(a.start);
  return db.waitlist.filter((w) => w.date === a.date && (w.part === 'any' || w.part === part)).sort((x, y) => x.createdAt - y.createdAt);
}
