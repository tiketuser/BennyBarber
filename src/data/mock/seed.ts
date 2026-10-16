// Deterministic demo data relative to "today", so the app always looks lived-in.
import type { Appointment, DbSnapshot, GalleryItem, Settings, WaitlistEntry } from '@/domain/types';
import { DEFAULTS } from '@/config/shop';
import { addDays, todayKey } from '@/lib/time';
import { hoursFor, slotsFor } from '@/domain/schedule';

const FIRST = ['יוסי', 'דניאל', 'משה', 'רון', 'אלון', 'שי', 'עומר', 'נתנאל', 'ליאור', 'אבי', 'איתי', 'עידן', 'אורי', 'מתן', 'יונתן', 'אליה', 'תומר', 'גיא', 'עמית', 'נועם'];
const LAST = ['לוי', 'כהן', 'אזולאי', 'ביטון', 'פרץ', 'גבאי', 'דהן', 'אוחיון', 'חדד', 'מזרחי', 'שושן', 'אברהם', 'פרידמן', 'מלכה', 'עמר'];
const NOTES = ['קצר בצדדים, להשאיר אורך למעלה', 'פייד נמוך', 'רק לסדר את הזקן', 'כמו בפעם הקודמת'];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const pick = <T>(r: () => number, arr: readonly T[]) => arr[Math.floor(r() * arr.length)];

export function buildSeed(now = new Date()): DbSnapshot {
  const r = rng(20261016);
  const today = todayKey(now);
  const db: DbSnapshot = {
    services: DEFAULTS.services.map((s) => ({ ...s })),
    settings: structuredClone(DEFAULTS.settings),
    appointments: [],
    blocks: [],
    waitlist: [],
    gallery: buildGallery(),
  };
  let n = 0;
  const id = () => `seed-${++n}`;
  const person = () => {
    const name = `${pick(r, FIRST)} ${pick(r, LAST)}`;
    const phone = '05' + String(Math.floor(r() * 1e8)).padStart(8, '0');
    return { name, phone };
  };

  const fill = (date: string, density: number, notesChance = 0.25) => {
    const h = hoursFor(db.settings, date);
    if (!h) return;
    const day: DbSnapshot = { ...db, appointments: [] };
    for (let guard = 0; guard < 40; guard++) {
      let svc = r() < 0.4 ? db.services[1] : pick(r, db.services);
      let free = slotsFor(day, date, svc.durationMin, new Date(0)).filter((s) => s.available);
      // A long service may not fit while short ones still do: keep filling with the shortest one.
      if (!free.length) {
        svc = db.services.reduce((a, b) => (b.durationMin < a.durationMin ? b : a));
        free = slotsFor(day, date, svc.durationMin, new Date(0)).filter((s) => s.available);
      }
      if (!free.length) break;
      const filled = day.appointments.reduce((t, a) => t + (a.end - a.start), 0);
      if (filled / (h.to - h.from) >= density) break;
      const slot = pick(r, free);
      const p = person();
      const appt: Appointment = {
        id: id(),
        date,
        start: slot.start,
        end: slot.start + svc.durationMin,
        serviceId: svc.id,
        serviceName: svc.name,
        price: svc.price,
        customerName: p.name,
        phone: p.phone,
        notes: r() < notesChance ? pick(r, NOTES) : undefined,
        status: 'booked',
        source: r() < 0.15 ? 'walkin' : 'app',
        createdAt: now.getTime() - Math.floor(r() * 10) * 86400000,
      };
      day.appointments.push(appt);
      db.appointments.push(appt);
    }
  };

  // ~14 months of history for the revenue chart, with a gentle seasonal curve.
  for (let d = -420; d < 0; d++) {
    const date = addDays(today, d);
    const month = Number(date.slice(5, 7));
    const season = month >= 6 && month <= 9 ? 0.78 : month === 1 || month === 2 ? 0.6 : 0.7;
    fill(date, season + (r() - 0.5) * 0.2, 0);
  }
  for (const a of db.appointments) {
    if (r() < 0.05) {
      a.status = 'cancelled';
      a.cancelledAt = a.createdAt;
      a.cancelledBy = 'customer';
      a.openingHandled = true;
    }
  }

  // Upcoming three weeks. One day fully booked to show the waitlist.
  const fullDay = nextOpenDay(db.settings, today, 5);
  for (let d = 0; d < 21; d++) {
    const date = addDays(today, d);
    fill(date, date === fullDay ? 1 : d === 0 ? 0.65 : 0.55 - d * 0.02, 0.3);
  }

  const waitlist = (date: string, entries: [string, WaitlistEntry['part'], number][]) => {
    for (const [name, part, hoursAgo] of entries) {
      db.waitlist.push({ id: id(), date, part, name, phone: '05' + String(Math.floor(r() * 1e8)).padStart(8, '0'), createdAt: now.getTime() - hoursAgo * 3600000 });
    }
  };
  waitlist(today, [
    ['עומר דהן', 'noon', 20],
    ['נתנאל אוחיון', 'any', 4],
    ['ליאור חדד', 'evening', 1],
  ]);
  if (fullDay)
    waitlist(fullDay, [
      ['גיא מלכה', 'any', 30],
      ['תומר עמר', 'evening', 6],
    ]);

  db.appointments.sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));
  return db;
}

function nextOpenDay(settings: Settings, from: string, skip: number): string | null {
  let seen = 0;
  for (let d = 1; d < 30; d++) {
    const date = addDays(from, d);
    if (hoursFor(settings, date) && ++seen === skip) return date;
  }
  return null;
}

function buildGallery(): GalleryItem[] {
  const cats: GalleryItem['category'][] = [
    'haircut',
    'beard',
    'haircut',
    'kids',
    'haircut',
    'beard',
    'haircut',
    'haircut',
    'kids',
    'beard',
    'haircut',
    'haircut',
    'beard',
    'haircut',
    'kids',
  ];
  return cats.map((category, i) => ({ id: `g${i + 1}`, category, pinned: i < 4, order: i }));
}
