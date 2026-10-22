// In-memory backend persisted to localStorage. Behaves like the real one (async, validated, live updates),
// and syncs between browser tabs so customer and admin can be tested side by side.
import { walkInEnd } from '../walkIn';
import type { Backend, BookingInput, WalkInInput } from '../backend';
import type { Appointment, DbSnapshot, Service, Session } from '@/domain/types';
import { assertBookable, assertWithinBookingWindow } from '@/domain/schedule';
import { ADMIN_PHONES, BOOKING_MONTHS, g } from '@/config/shop';
import { phoneDigits } from '@/lib/phone';
import { buildSeed } from './seed';

const DB_KEY = 'bb.db.v1';
const SESSION_KEY = 'bb.session.v1';
/** Names customers saved once, by phone, so a returning number skips the name step. */
const NAMES_KEY = 'bb.names.v1';
/** Demo admin number. In production the admin list lives on the server (Firestore `admins` / custom claims). */

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** False when the browser refused (storage full or blocked); the app keeps working in memory. */
function save(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const dataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('לא הצלחנו לקרוא את התמונה'));
    r.readAsDataURL(blob);
  });

export function createMockBackend(): Backend {
  let db: DbSnapshot = load<DbSnapshot>(DB_KEY) ?? buildSeed();
  let session: Session | null = load<Session>(SESSION_KEY);
  const dbListeners = new Set<() => void>();
  const authListeners = new Set<() => void>();
  let pendingPhone: string | null = null;

  const emit = () => dbListeners.forEach((l) => l());
  const emitAuth = () => authListeners.forEach((l) => l());

  /** Every write produces a new snapshot object (immutable), then persists and notifies. */
  const commit = (next: DbSnapshot) => {
    db = next;
    save(DB_KEY, db);
    emit();
  };
  const setSession = (s: Session | null) => {
    session = s;
    save(SESSION_KEY, s);
    emitAuth();
  };

  window.addEventListener('storage', (e) => {
    if (e.key === DB_KEY) {
      db = load<DbSnapshot>(DB_KEY) ?? db;
      emit();
    }
  });

  const requireSession = (): Session => {
    if (!session) throw new Error('צריך להתחבר קודם');
    return session;
  };
  const requireAdmin = () => {
    if (session?.role !== 'admin') throw new Error('פעולה למנהל בלבד');
  };
  /** Customers may only touch their own records; the admin may touch any. */
  const requireOwner = (customerPhone: string | undefined) => {
    const s = requireSession();
    if (s.role !== 'admin' && customerPhone !== s.phone) throw new Error('אין הרשאה לפעולה הזו');
  };
  const appointment = (id: string) => {
    const a = db.appointments.find((x) => x.id === id);
    if (!a) throw new Error('התור לא נמצא');
    return a;
  };
  const service = (id: string) => {
    const s = db.services.find((x) => x.id === id);
    if (!s) throw new Error('הטיפול לא נמצא');
    return s;
  };
  const patchAppointments = (fn: (a: Appointment) => Appointment) => commit({ ...db, appointments: db.appointments.map(fn) });
  const loadNames = () => load<Record<string, string>>(NAMES_KEY) ?? {};

  const backend: Backend = {
    subscribe(l) {
      dbListeners.add(l);
      return () => dbListeners.delete(l);
    },
    getSnapshot: () => db,

    auth: {
      getSession: () => session,
      subscribe(l) {
        authListeners.add(l);
        return () => authListeners.delete(l);
      },
      async signInCustomer(phone, name) {
        await wait(300);
        const digits = phoneDigits(phone);
        if (ADMIN_PHONES.includes(digits)) throw new Error('למספר של המנהל נכנסים עם קוד מנהל');
        const clean = name.trim();
        save(NAMES_KEY, { ...loadNames(), [digits]: clean });
        const s: Session = { phone: digits, name: clean, role: 'customer' };
        setSession(s);
        return s;
      },
      async sendCode(phone) {
        await wait(400);
        pendingPhone = phoneDigits(phone);
      },
      async verifyCode(phone, code) {
        await wait(300);
        const digits = phoneDigits(phone);
        if (pendingPhone !== digits || !/^\d{6}$/.test(code)) throw new Error(`הקוד לא נכון, ${g('נסה', 'נסי', 'נסו')} שוב`);
        const role = ADMIN_PHONES.includes(digits) ? 'admin' : 'customer';
        const s: Session = { phone: digits, name: loadNames()[digits] ?? null, role };
        setSession(s);
        return s;
      },
      async saveName(name) {
        const s = requireSession();
        const clean = name.trim();
        save(NAMES_KEY, { ...loadNames(), [s.phone]: clean });
        setSession({ ...s, name: clean });
      },
      async signOut() {
        setSession(null);
      },
    },

    appointments: {
      async book(input: BookingInput) {
        await wait();
        const me = requireSession();
        if (input.replacesId) requireOwner(appointment(input.replacesId).customerPhone);
        const svc = service(input.serviceId);
        const end = input.start + svc.durationMin;
        assertWithinBookingWindow(input.date, BOOKING_MONTHS);
        assertBookable(db, input.date, input.start, end, { ignoreId: input.replacesId });
        const appt: Appointment = {
          id: uid(),
          date: input.date,
          start: input.start,
          end,
          serviceId: svc.id,
          serviceName: svc.name,
          price: svc.price,
          customerName: input.customerName.trim(),
          phone: phoneDigits(input.phone),
          customerPhone: me.phone,
          notes: input.notes?.trim() || undefined,
          status: 'booked',
          source: 'app',
          createdAt: Date.now(),
        };
        let appointments = [...db.appointments, appt];
        if (input.replacesId) {
          // The old slot is freed like any cancellation, so people waiting for it get offered it.
          appointments = appointments.map((a) =>
            a.id === input.replacesId ? { ...a, status: 'cancelled', cancelledAt: Date.now(), cancelledBy: 'customer', openingHandled: false } : a,
          );
        }
        // Booking a day you were waiting on removes you from that day's waitlist.
        const waitlist = db.waitlist.filter((w) => !(w.date === input.date && w.customerPhone === me.phone));
        commit({ ...db, appointments, waitlist });
        return appt;
      },
      async addWalkIn(input: WalkInInput) {
        requireAdmin();
        await wait(60);
        const svc = service(input.serviceId);
        const end = walkInEnd(input, svc.durationMin);
        // The barber can also write down a client who already came earlier today.
        assertBookable(db, input.date, input.start, end, { allowPast: true, allowOverlap: !!input.squeeze, anyHour: true });
        const appt: Appointment = {
          id: uid(),
          date: input.date,
          start: input.start,
          end,
          serviceId: svc.id,
          serviceName: svc.name,
          price: svc.price,
          customerName: input.customerName?.trim() || 'לקוח מזדמן',
          phone: phoneDigits(input.phone ?? ''),
          notes: input.notes?.trim() || undefined,
          status: 'booked',
          source: 'walkin',
          createdAt: Date.now(),
        };
        commit({ ...db, appointments: [...db.appointments, appt] });
        return appt;
      },
      async cancel(id) {
        await wait(60);
        requireOwner(appointment(id).customerPhone);
        const by = session!.role;
        patchAppointments((a) => (a.id === id ? { ...a, status: 'cancelled', cancelledAt: Date.now(), cancelledBy: by, openingHandled: false } : a));
      },
      async setNoShow(id, noShow) {
        requireAdmin();
        await wait(60);
        patchAppointments((a) => {
          if (a.id !== id) return a;
          if (noShow) return { ...a, status: 'cancelled', cancelledAt: Date.now(), cancelledBy: 'admin', openingHandled: true, noShow: true };
          return { ...a, status: 'booked', cancelledAt: undefined, cancelledBy: undefined, openingHandled: undefined, noShow: undefined };
        });
      },
      async delay(date, ids, minutes) {
        requireAdmin();
        await wait(60);
        patchAppointments((a) => {
          if (a.date !== date || !ids.includes(a.id)) return a;
          const total = (a.delayMin ?? 0) + minutes;
          return { ...a, start: a.start + minutes, end: a.end + minutes, delayMin: total > 0 ? total : undefined };
        });
      },
      async markOpeningHandled(id) {
        requireAdmin();
        patchAppointments((a) => (a.id === id ? { ...a, openingHandled: true } : a));
      },
      async retime(date, times) {
        requireAdmin();
        const byId = new Map(times.map((x) => [x.id, x]));
        patchAppointments((a) => {
          const x = a.date === date ? byId.get(a.id) : undefined;
          return x ? { ...a, start: x.start, end: x.end } : a;
        });
      },
    },

    blocks: {
      async add(date, start, end, label) {
        requireAdmin();
        const block = { id: uid(), date, start, end, label };
        commit({ ...db, blocks: [...db.blocks, block] });
        return block;
      },
      async update(id, range) {
        requireAdmin();
        commit({ ...db, blocks: db.blocks.map((b) => (b.id === id ? { ...b, start: range.from, end: range.to } : b)) });
      },
      async remove(id) {
        requireAdmin();
        commit({ ...db, blocks: db.blocks.filter((b) => b.id !== id) });
      },
    },

    waitlist: {
      async join(date, part, name, phone) {
        await wait();
        const mine = requireSession().phone;
        const rest = db.waitlist.filter((w) => !(w.date === date && w.customerPhone === mine));
        commit({ ...db, waitlist: [...rest, { id: uid(), date, part, name, phone: phoneDigits(phone), customerPhone: mine, createdAt: Date.now() }] });
      },
      async leave(id) {
        requireOwner(db.waitlist.find((w) => w.id === id)?.customerPhone);
        commit({ ...db, waitlist: db.waitlist.filter((w) => w.id !== id) });
      },
    },

    services: {
      async add(input) {
        requireAdmin();
        const s: Service = { ...input, id: uid(), order: Math.max(-1, ...db.services.map((x) => x.order)) + 1 };
        commit({ ...db, services: [...db.services, s] });
        return s;
      },
      async update(id, patch) {
        requireAdmin();
        commit({ ...db, services: db.services.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
      },
      async remove(id) {
        requireAdmin();
        commit({ ...db, services: db.services.filter((s) => s.id !== id) });
      },
      async restore(service) {
        requireAdmin();
        commit({ ...db, services: [...db.services.filter((s) => s.id !== service.id), service].sort((a, b) => a.order - b.order) });
      },
    },

    settings: {
      async setHours(days, hours) {
        requireAdmin();
        const next = { ...db.settings.hours };
        for (const d of days) next[d] = { ...hours };
        commit({ ...db, settings: { ...db.settings, hours: next } });
      },
      async setLogo(photo) {
        requireAdmin();
        commit({ ...db, settings: { ...db.settings, logoUrl: photo ? URL.createObjectURL(photo) : null } });
      },
      async setBreak(range) {
        requireAdmin();
        commit({ ...db, settings: { ...db.settings, breakTime: range } });
      },
      async addVacation(from, to) {
        requireAdmin();
        if (to < from) throw new Error('יום הסוף לפני יום ההתחלה');
        const v = { id: uid(), from, to };
        // Appointments in the vacation are cancelled; the admin is offered to message each client.
        const appointments = db.appointments.map((a) =>
          a.status === 'booked' && a.date >= from && a.date <= to
            ? { ...a, status: 'cancelled' as const, cancelledAt: Date.now(), cancelledBy: 'admin' as const, openingHandled: true }
            : a,
        );
        commit({ ...db, appointments, settings: { ...db.settings, vacations: [...db.settings.vacations, v] } });
        return v;
      },
      async removeVacation(id) {
        requireAdmin();
        commit({ ...db, settings: { ...db.settings, vacations: db.settings.vacations.filter((v) => v.id !== id) } });
      },
    },

    gallery: {
      async upload(photo, category) {
        requireAdmin();
        if (!photo.type.startsWith('image/')) throw new Error('אפשר להעלות רק תמונות');
        // The demo keeps photos inside the browser's storage; Firebase Storage replaces this.
        const item = { id: uid(), src: await dataUrl(photo), category, pinned: false, order: Math.min(0, ...db.gallery.map((g) => g.order)) - 1 };
        const next = { ...db, gallery: [item, ...db.gallery] };
        if (!save(DB_KEY, next)) throw new Error('אין מקום לעוד תמונות בגרסה הזו. מחק כמה ונסה שוב.');
        commit(next);
        return item;
      },
      async togglePin(id) {
        requireAdmin();
        commit({ ...db, gallery: db.gallery.map((g) => (g.id === id ? { ...g, pinned: !g.pinned } : g)) });
      },
      async remove(id) {
        requireAdmin();
        commit({ ...db, gallery: db.gallery.filter((g) => g.id !== id) });
      },
      async restore(item) {
        requireAdmin();
        commit({ ...db, gallery: [...db.gallery.filter((g) => g.id !== item.id), item].sort((a, b) => a.order - b.order) });
      },
    },
  };
  return backend;
}
