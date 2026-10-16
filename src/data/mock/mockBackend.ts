// In-memory backend persisted to localStorage. Behaves like the real one (async, validated, live updates),
// and syncs between browser tabs so customer and admin can be tested side by side.
import type { Backend, BookingInput, WalkInInput } from '../backend';
import type { Appointment, DbSnapshot, Service, Session } from '@/domain/types';
import { assertBookable } from '@/domain/schedule';
import { phoneDigits } from '@/lib/phone';
import { buildSeed, seedCustomerHistory } from './seed';

const DB_KEY = 'bb.db.v1';
const SESSION_KEY = 'bb.session.v1';
/** Demo admin number. In production the admin list lives on the server (Firestore `admins` / custom claims). */
const ADMIN_PHONES = ['0500000000'];

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

function save(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

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

  const requireAdmin = () => {
    if (session?.role !== 'admin') throw new Error('פעולה למנהל בלבד');
  };
  const service = (id: string) => {
    const s = db.services.find((x) => x.id === id);
    if (!s) throw new Error('הטיפול לא נמצא');
    return s;
  };
  const patchAppointments = (fn: (a: Appointment) => Appointment) => commit({ ...db, appointments: db.appointments.map(fn) });

  const backend: Backend = {
    kind: 'mock',
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
      async sendCode(phone) {
        await wait(400);
        pendingPhone = phoneDigits(phone);
      },
      async verifyCode(phone, code) {
        await wait(300);
        const digits = phoneDigits(phone);
        if (pendingPhone !== digits || !/^\d{4}$/.test(code)) throw new Error('הקוד לא נכון, נסה שוב');
        const known = load<Record<string, string>>('bb.names.v1') ?? {};
        const role = ADMIN_PHONES.includes(digits) ? 'admin' : 'customer';
        const s: Session = { phone: digits, name: known[digits] ?? null, role };
        setSession(s);
        return s;
      },
      async saveName(name) {
        if (!session) throw new Error('לא מחובר');
        const clean = name.trim();
        const known = load<Record<string, string>>('bb.names.v1') ?? {};
        known[session.phone] = clean;
        save('bb.names.v1', known);
        if (session.role === 'customer' && !db.appointments.some((a) => a.customerPhone === session!.phone)) {
          commit({ ...db, appointments: [...db.appointments, ...seedCustomerHistory(db, session.phone, clean)] });
        }
        setSession({ ...session, name: clean });
      },
      async signOut() {
        setSession(null);
      },
    },

    appointments: {
      async book(input: BookingInput) {
        await wait();
        const svc = service(input.serviceId);
        const end = input.start + svc.durationMin;
        assertBookable(db, input.date, input.start, end, input.replacesId);
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
          customerPhone: session?.phone,
          notes: input.notes?.trim() || undefined,
          status: 'booked',
          source: 'app',
          createdAt: Date.now(),
        };
        let appointments = [...db.appointments, appt];
        if (input.replacesId) {
          appointments = appointments.map((a) =>
            a.id === input.replacesId ? { ...a, status: 'cancelled', cancelledAt: Date.now(), cancelledBy: 'customer' } : a,
          );
        }
        // Booking a day you were waiting on removes you from that day's waitlist.
        const waitlist = db.waitlist.filter((w) => !(w.date === input.date && session && w.customerPhone === session.phone));
        commit({ ...db, appointments, waitlist });
        return appt;
      },
      async addWalkIn(input: WalkInInput) {
        requireAdmin();
        await wait(60);
        const svc = service(input.serviceId);
        const end = input.start + svc.durationMin;
        assertBookable(db, input.date, input.start, end);
        const appt: Appointment = {
          id: uid(),
          date: input.date,
          start: input.start,
          end,
          serviceId: svc.id,
          serviceName: svc.name,
          price: svc.price,
          customerName: input.customerName?.trim() || 'לקוח מזדמן',
          phone: '',
          status: 'booked',
          source: 'walkin',
          createdAt: Date.now(),
        };
        commit({ ...db, appointments: [...db.appointments, appt] });
        return appt;
      },
      async cancel(id, by) {
        await wait(60);
        patchAppointments((a) => (a.id === id ? { ...a, status: 'cancelled', cancelledAt: Date.now(), cancelledBy: by, openingHandled: false } : a));
      },
      async markOpeningHandled(id) {
        patchAppointments((a) => (a.id === id ? { ...a, openingHandled: true } : a));
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
        const mine = session?.phone;
        const rest = db.waitlist.filter((w) => !(w.date === date && mine && w.customerPhone === mine));
        commit({ ...db, waitlist: [...rest, { id: uid(), date, part, name, phone: phoneDigits(phone), customerPhone: mine, createdAt: Date.now() }] });
      },
      async leave(id) {
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
      async setBreak(range) {
        requireAdmin();
        commit({ ...db, settings: { ...db.settings, breakTime: range } });
      },
      async addVacation(from, to) {
        requireAdmin();
        const v = { id: uid(), from, to };
        // Appointments in the vacation are cancelled; the admin is offered to message each client.
        const appointments = db.appointments.map((a) =>
          a.status === 'booked' && a.date >= from && a.date <= to ? { ...a, status: 'cancelled' as const, cancelledAt: Date.now(), cancelledBy: 'admin' as const, openingHandled: true } : a,
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
      async togglePin(id) {
        requireAdmin();
        commit({ ...db, gallery: db.gallery.map((g) => (g.id === id ? { ...g, pinned: !g.pinned } : g)) });
      },
      async reorder(items) {
        requireAdmin();
        commit({ ...db, gallery: items.map((g, i) => ({ ...g, order: i })) });
      },
    },

    dev: {
      adminHint: 'לניסיון: 050-0000000 נכנס כמנהל, כל מספר אחר כלקוח. כל קוד של 4 ספרות עובד.',
      reset() {
        commit(buildSeed());
      },
      switchRole(role) {
        if (role === 'admin') setSession({ phone: ADMIN_PHONES[0], name: 'מנהל', role: 'admin' });
        else setSession({ phone: '0521234567', name: (load<Record<string, string>>('bb.names.v1') ?? {})['0521234567'] ?? 'יוסי לוי', role: 'customer' });
        if (role === 'customer' && !db.appointments.some((a) => a.customerPhone === '0521234567')) {
          commit({ ...db, appointments: [...db.appointments, ...seedCustomerHistory(db, '0521234567', 'יוסי לוי')] });
        }
      },
    },
  };
  return backend;
}
