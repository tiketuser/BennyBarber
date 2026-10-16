import { describe, expect, it } from 'vitest';
import { appt, emptyDb, FRIDAY, MONDAY_MORNING, SATURDAY, TUESDAY } from '@/test/fixtures';
import { assertBookable, dayStatus, freeGaps, nextFreeStart, slotsFor } from './schedule';

const free = (db: ReturnType<typeof emptyDb>, date: string, len: number) =>
  slotsFor(db, date, len, MONDAY_MORNING)
    .filter((s) => s.available)
    .map((s) => s.start);

describe('slotsFor', () => {
  it('offers the 30-minute grid inside opening hours, skipping the break', () => {
    const starts = free(emptyDb(), TUESDAY, 30);
    expect(starts[0]).toBe(540);
    expect(starts.at(-1)).toBe(1170);
    expect(starts).not.toContain(780);
    expect(starts).toContain(810);
  });

  it('offers the end of a 45-minute booking so no 15 minutes are wasted', () => {
    const db = emptyDb();
    db.appointments.push(appt(TUESDAY, 540, 45));
    const starts = free(db, TUESDAY, 30);
    expect(starts).toContain(585);
    expect(starts).not.toContain(540);
  });

  it('marks overlapping grid slots as taken and hides cancelled appointments', () => {
    const db = emptyDb();
    db.appointments.push(appt(TUESDAY, 600), appt(TUESDAY, 660, 30, { status: 'cancelled' }));
    const slots = slotsFor(db, TUESDAY, 30, MONDAY_MORNING);
    expect(slots.find((s) => s.start === 600)?.available).toBe(false);
    expect(slots.find((s) => s.start === 660)?.available).toBe(true);
  });

  it('only offers times at least 10 minutes from now on the same day', () => {
    const monday = '2026-10-19';
    const starts = free(emptyDb(), monday, 30);
    expect(starts[0]).toBe(630); // now is 10:05, so 10:30 is the first
  });

  it('has nothing on a closed day', () => {
    expect(slotsFor(emptyDb(), SATURDAY, 30, MONDAY_MORNING)).toEqual([]);
  });
});

describe('dayStatus', () => {
  it('tells closed, vacation, full and almost full apart', () => {
    const db = emptyDb();
    expect(dayStatus(db, SATURDAY, 30, MONDAY_MORNING)).toBe('closed');
    db.settings.vacations.push({ id: 'v', from: TUESDAY, to: TUESDAY });
    expect(dayStatus(db, TUESDAY, 30, MONDAY_MORNING)).toBe('vacation');
    expect(dayStatus(db, FRIDAY, 30, MONDAY_MORNING)).toBe('open');
    db.blocks.push({ id: 'b', date: FRIDAY, start: 510, end: 810 });
    expect(dayStatus(db, FRIDAY, 30, MONDAY_MORNING)).toBe('almost-full');
    db.blocks.push({ id: 'b2', date: FRIDAY, start: 810, end: 870 });
    expect(dayStatus(db, FRIDAY, 30, MONDAY_MORNING)).toBe('full');
  });

  it('calls today closed, not full, once the last start time has passed', () => {
    const evening = new Date(2026, 9, 19, 19, 55);
    expect(dayStatus(emptyDb(), '2026-10-19', 30, evening)).toBe('closed');
  });
});

describe('freeGaps', () => {
  it('lists the free windows between bookings, blocks and the break', () => {
    const db = emptyDb();
    db.appointments.push(appt(FRIDAY, 510, 60));
    db.blocks.push({ id: 'b', date: FRIDAY, start: 600, end: 750 });
    expect(freeGaps(db, FRIDAY, 20, MONDAY_MORNING)).toEqual([
      { from: 570, to: 600 },
      { from: 750, to: 780 },
      { from: 810, to: 870 },
    ]);
    expect(nextFreeStart(db, FRIDAY, 45, MONDAY_MORNING)).toBe(810);
  });

  it('starts from now on today and returns nothing for past days', () => {
    expect(freeGaps(emptyDb(), '2026-10-19', 20, MONDAY_MORNING)[0].from).toBe(605);
    expect(freeGaps(emptyDb(), '2026-10-18', 20, MONDAY_MORNING)).toEqual([]);
  });
});

describe('assertBookable', () => {
  const db = emptyDb();
  db.appointments.push(appt(TUESDAY, 600));
  const now = { now: MONDAY_MORNING };

  it('accepts a free slot', () => {
    expect(() => assertBookable(db, TUESDAY, 630, 660, now)).not.toThrow();
  });
  it('rejects closed days, times outside hours, overlaps and past times', () => {
    expect(() => assertBookable(db, SATURDAY, 600, 630, now)).toThrow('סגורה');
    expect(() => assertBookable(db, TUESDAY, 1190, 1220, now)).toThrow('מחוץ לשעות');
    expect(() => assertBookable(db, TUESDAY, 615, 645, now)).toThrow('נתפסה');
    expect(() => assertBookable(db, '2026-10-19', 540, 570, now)).toThrow('עברה');
  });
  it('ignores the appointment being rescheduled', () => {
    expect(() => assertBookable(db, TUESDAY, 600, 630, { ...now, ignoreId: db.appointments[0].id })).not.toThrow();
  });
});
