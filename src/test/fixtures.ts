// Small, hand-made data for unit tests. Default hours: Sun-Thu 09:00-20:00, Fri 08:30-14:30, Sat closed, break 13:00-13:30.
import type { Appointment, DbSnapshot } from '@/domain/types';

export const TUESDAY = '2026-10-20';
export const FRIDAY = '2026-10-23';
export const SATURDAY = '2026-10-24';
/** Monday 2026-10-19 10:05 local time. */
export const MONDAY_MORNING = new Date(2026, 9, 19, 10, 5);

export function emptyDb(): DbSnapshot {
  return {
    services: [
      { id: 'cut', name: 'תספורת גבר', shortName: 'תספורת', price: 70, durationMin: 30, priceHidden: false, order: 0 },
      { id: 'cut-beard', name: 'תספורת + זקן', shortName: 'תספורת + זקן', price: 100, durationMin: 45, priceHidden: false, order: 1 },
      { id: 'beard', name: 'עיצוב זקן', shortName: 'זקן', price: 50, durationMin: 20, priceHidden: false, order: 2 },
    ],
    settings: {
      hours: {
        0: { open: true, from: 540, to: 1200 },
        1: { open: true, from: 540, to: 1200 },
        2: { open: true, from: 540, to: 1200 },
        3: { open: true, from: 540, to: 1200 },
        4: { open: true, from: 540, to: 1200 },
        5: { open: true, from: 510, to: 870 },
        6: { open: false, from: 540, to: 840 },
      },
      breakTime: { from: 780, to: 810 },
      vacations: [],
    },
    appointments: [],
    blocks: [],
    waitlist: [],
    gallery: [],
  };
}

let n = 0;
export function appt(date: string, start: number, durationMin = 30, extra: Partial<Appointment> = {}): Appointment {
  return {
    id: `a${++n}`,
    date,
    start,
    end: start + durationMin,
    serviceId: 'cut',
    serviceName: 'תספורת גבר',
    price: 70,
    customerName: 'בדיקה',
    phone: '0521111111',
    status: 'booked',
    source: 'app',
    createdAt: 0,
    ...extra,
  };
}
