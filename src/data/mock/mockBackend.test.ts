import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Backend } from '../backend';
import { appt, emptyDb, MONDAY_MORNING, SATURDAY, TUESDAY } from '@/test/fixtures';
import { createMockBackend } from './mockBackend';
import { ADMIN_PHONES } from '@/config/shop';

const ADMIN = ADMIN_PHONES[0];
const ME = '052-1234567';

async function signIn(b: Backend, phone: string, name = 'יוסי לוי') {
  await b.auth.sendCode(phone);
  const s = await b.auth.verifyCode(phone, '123456');
  if (s.role === 'customer' && !s.name) await b.auth.saveName(name);
  return s;
}

describe('mock backend', () => {
  let b: Backend;
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: MONDAY_MORNING });
    localStorage.clear();
    const db = emptyDb();
    db.appointments.push(appt(TUESDAY, 600, 30, { customerName: 'אחר', phone: '0529999999', customerPhone: '0529999999' }));
    localStorage.setItem('bb.db.v1', JSON.stringify(db));
    b = createMockBackend();
  });

  it('gives the admin number the admin role and everyone else the customer role', async () => {
    expect((await signIn(b, ADMIN)).role).toBe('admin');
    await b.auth.signOut();
    expect((await signIn(b, ME)).role).toBe('customer');
    expect(b.auth.getSession()?.name).toBe('יוסי לוי');
  });

  it('signs customers in with number and name only, and sends admin numbers to the SMS code', async () => {
    const s = await b.auth.signInCustomer(ME, ' דנה ');
    expect(s).toEqual({ phone: '0521234567', name: 'דנה', role: 'customer' });
    await b.auth.signOut();
    await expect(b.auth.signInCustomer(ADMIN, 'x')).rejects.toThrow();
    expect(b.auth.getSession()).toBeNull();
  });

  it('remembers a returning customer by phone, so the name step is skipped', async () => {
    await signIn(b, ME, 'דני');
    await b.auth.signOut();
    await b.auth.sendCode(ME);
    expect((await b.auth.verifyCode(ME, '000000')).name).toBe('דני');
  });

  it('rejects a code that is not 6 digits, or for another number', async () => {
    await b.auth.sendCode(ME);
    await expect(b.auth.verifyCode(ME, '12')).rejects.toThrow();
    await expect(b.auth.verifyCode('052-7654321', '123456')).rejects.toThrow();
  });

  it('books only when signed in and the slot is free', async () => {
    const input = { serviceId: 'cut', date: TUESDAY, start: 630, customerName: 'יוסי לוי', phone: ME };
    await expect(b.appointments.book(input)).rejects.toThrow('להתחבר');
    await signIn(b, ME);
    const a = await b.appointments.book({ ...input, notes: '  פייד  ' });
    expect(a).toMatchObject({ end: 660, price: 70, customerPhone: '0521234567', notes: 'פייד' });
    await expect(b.appointments.book(input)).rejects.toThrow('נתפסה');
    await expect(b.appointments.book({ ...input, start: 600 })).rejects.toThrow('נתפסה');
  });

  it('reschedules by cancelling the old appointment and freeing it for the waitlist', async () => {
    await signIn(b, ME);
    const first = await b.appointments.book({ serviceId: 'cut', date: TUESDAY, start: 630, customerName: 'יוסי', phone: ME });
    await b.appointments.book({ serviceId: 'cut', date: TUESDAY, start: 700, customerName: 'יוסי', phone: ME, replacesId: first.id });
    const old = b.getSnapshot().appointments.find((a) => a.id === first.id)!;
    expect(old).toMatchObject({ status: 'cancelled', openingHandled: false, cancelledBy: 'customer' });
  });

  it("does not let a customer cancel someone else's appointment", async () => {
    await signIn(b, ME);
    const theirs = b.getSnapshot().appointments[0].id;
    await expect(b.appointments.cancel(theirs)).rejects.toThrow('הרשאה');
    await b.auth.signOut();
    await signIn(b, ADMIN);
    await b.appointments.cancel(theirs);
    expect(b.getSnapshot().appointments[0]).toMatchObject({ status: 'cancelled', cancelledBy: 'admin' });
  });

  it('keeps one waitlist entry per customer per day and drops it once they book that day', async () => {
    await signIn(b, ME);
    await b.waitlist.join(TUESDAY, 'morning', 'יוסי', ME);
    await b.waitlist.join(TUESDAY, 'evening', 'יוסי', ME);
    expect(b.getSnapshot().waitlist).toHaveLength(1);
    expect(b.getSnapshot().waitlist[0].part).toBe('evening');
    await b.appointments.book({ serviceId: 'cut', date: TUESDAY, start: 900, customerName: 'יוסי', phone: ME });
    expect(b.getSnapshot().waitlist).toHaveLength(0);
  });

  it('keeps admin actions for the admin', async () => {
    await signIn(b, ME);
    await expect(b.blocks.add(TUESDAY, 600, 630)).rejects.toThrow('למנהל');
    await expect(b.services.update('cut', { price: 1 })).rejects.toThrow('למנהל');
    await expect(b.settings.addVacation(TUESDAY, TUESDAY)).rejects.toThrow('למנהל');
  });

  it('cancels the appointments inside a new vacation', async () => {
    await signIn(b, ADMIN);
    await expect(b.settings.addVacation(TUESDAY, '2026-10-19')).rejects.toThrow();
    await b.settings.addVacation(TUESDAY, TUESDAY);
    const snap = b.getSnapshot();
    expect(snap.appointments[0].status).toBe('cancelled');
    expect(snap.settings.vacations).toHaveLength(1);
    // The admin can still write someone in by hand; customers can't book the day.
    await expect(b.appointments.addWalkIn({ serviceId: 'cut', date: TUESDAY, start: 700 })).resolves.toBeTruthy();
  });

  it('adds walk-ins and restores a deleted service in its place', async () => {
    await signIn(b, ADMIN);
    const w = await b.appointments.addWalkIn({ serviceId: 'beard', date: TUESDAY, start: 540 });
    expect(w).toMatchObject({ customerName: 'לקוח מזדמן', end: 560, source: 'walkin' });
    const svc = b.getSnapshot().services[1];
    await b.services.remove(svc.id);
    await b.services.restore(svc);
    expect(b.getSnapshot().services.map((s) => s.id)).toEqual(['cut', 'cut-beard', 'beard']);
  });

  it('walk-ins take a chosen end, and a no-show frees the slot until undone', async () => {
    await signIn(b, ADMIN);
    await expect(b.appointments.addWalkIn({ serviceId: 'beard', date: TUESDAY, start: 540, end: 540 })).rejects.toThrow('שעת הסיום');
    const w = await b.appointments.addWalkIn({ serviceId: 'beard', date: TUESDAY, start: 540, end: 600 });
    expect(w.end).toBe(600);
    await b.appointments.setNoShow(w.id, true);
    expect(b.getSnapshot().appointments.find((a) => a.id === w.id)).toMatchObject({ status: 'cancelled', noShow: true, openingHandled: true });
    await b.appointments.setNoShow(w.id, false);
    expect(b.getSnapshot().appointments.find((a) => a.id === w.id)).toMatchObject({ status: 'booked', noShow: undefined });
  });

  it('admin walk-ins may go outside opening hours and on closed days', async () => {
    await signIn(b, ADMIN);
    const late = await b.appointments.addWalkIn({ serviceId: 'beard', date: TUESDAY, start: 22 * 60, end: 22 * 60 + 30 });
    expect(late.start).toBe(22 * 60);
    const sat = await b.appointments.addWalkIn({ serviceId: 'beard', date: SATURDAY, start: 600, end: 630 });
    expect(sat.date).toBe(SATURDAY);
  });

  it('squeezes a walk-in over a taken slot only when asked', async () => {
    await signIn(b, ADMIN);
    await b.appointments.addWalkIn({ serviceId: 'beard', date: TUESDAY, start: 540, end: 600 });
    await expect(b.appointments.addWalkIn({ serviceId: 'beard', date: TUESDAY, start: 560, end: 580 })).rejects.toThrow();
    const s = await b.appointments.addWalkIn({ serviceId: 'beard', date: TUESDAY, start: 560, end: 580, squeeze: true });
    expect(s.start).toBe(560);
  });

  it('delays appointments and takes the delay back', async () => {
    await signIn(b, ADMIN);
    const w = await b.appointments.addWalkIn({ serviceId: 'beard', date: TUESDAY, start: 540 });
    await b.appointments.delay(TUESDAY, [w.id], 15);
    await b.appointments.delay(TUESDAY, [w.id], 10);
    expect(b.getSnapshot().appointments.find((a) => a.id === w.id)).toMatchObject({ start: 565, end: 585, delayMin: 25 });
    await b.appointments.delay(TUESDAY, [w.id], -25);
    expect(b.getSnapshot().appointments.find((a) => a.id === w.id)).toMatchObject({ start: 540, end: 560, delayMin: undefined });
  });

  it('publishes a new snapshot object on every change', async () => {
    const before = b.getSnapshot();
    const listener = vi.fn();
    b.subscribe(listener);
    await signIn(b, ADMIN);
    await b.blocks.add(TUESDAY, 700, 730);
    expect(b.getSnapshot()).not.toBe(before);
    expect(listener).toHaveBeenCalled();
  });

  it('lets only the admin upload, delete and restore gallery photos', async () => {
    const photo = new Blob(['x'], { type: 'image/jpeg' });
    await signIn(b, ME);
    await expect(b.gallery.upload(photo, 'beard')).rejects.toThrow();
    await b.auth.signOut();
    await signIn(b, ADMIN);
    await expect(b.gallery.upload(new Blob(['x'], { type: 'text/plain' }), 'beard')).rejects.toThrow();
    const item = await b.gallery.upload(photo, 'beard');
    const first = [...b.getSnapshot().gallery].sort((x, y) => x.order - y.order)[0];
    expect(first.id).toBe(item.id);
    expect(item.src).toMatch(/^data:image\/jpeg/);
    await b.gallery.remove(item.id);
    expect(b.getSnapshot().gallery.some((g) => g.id === item.id)).toBe(false);
    await b.gallery.restore(item);
    expect(b.getSnapshot().gallery[0].id).toBe(item.id);
  });
});
