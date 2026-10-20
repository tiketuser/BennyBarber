// Firebase implementation of the Backend contract: phone (SMS) sign-in, Firestore, Storage.
// Data for one shop lives under shops/{shopId}; firestore.rules (generated from the shop config (shops/<id>/config.ts)) enforces who may do what.
import { initializeApp } from 'firebase/app';
import { RecaptchaVerifier, connectAuthEmulator, getAuth, onAuthStateChanged, signInWithPhoneNumber, signOut, type ConfirmationResult, type User } from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  initializeFirestore,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Transaction,
  type Unsubscribe,
} from 'firebase/firestore';
import { connectStorageEmulator, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import type { Backend, BookingInput, WalkInInput } from '../backend';
import type { Appointment, Block, DateKey, DbSnapshot, GalleryItem, Minutes, Service, Session, Settings, WaitlistEntry } from '@/domain/types';
import { assertBookable, assertWithinBookingWindow } from '@/domain/schedule';
import { ADMIN_PHONES, BOOKING_MONTHS, DEFAULTS, FIREBASE, g } from '@/config/shop';
import { fromIntl, phoneDigits, toIntl } from '@/lib/phone';
import { todayKey } from '@/lib/time';

/** One busy range on a day, published for customers without names or phones. */
interface BusyEntry {
  id: string;
  start: Minutes;
  end: Minutes;
}

const ERRORS: Record<string, string> = {
  'auth/invalid-phone-number': 'המספר לא תקין',
  'auth/too-many-requests': `יותר מדי ניסיונות. ${g('נסה', 'נסי', 'נסו')} שוב בעוד כמה דקות`,
  'auth/invalid-verification-code': `הקוד לא נכון, ${g('נסה', 'נסי', 'נסו')} שוב`,
  'auth/code-expired': `פג תוקף הקוד. ${g('שלח', 'שלחי', 'שלחו')} קוד חדש`,
  'auth/quota-exceeded': `שליחת ה-SMS לא זמינה כרגע. ${g('נסה', 'נסי', 'נסו')} שוב מאוחר יותר`,
  'auth/network-request-failed': 'אין חיבור לאינטרנט',
  'auth/operation-not-allowed': 'שליחת SMS לישראל עוד לא הופעלה במערכת',
  'auth/billing-not-enabled': 'שליחת SMS עוד לא הופעלה במערכת',
  'auth/unauthorized-domain': `הכתובת הזו לא מורשית להתחברות. ${g('נסה', 'נסי', 'נסו')} מהאתר הרשמי`,
  'auth/invalid-app-credential': `הכתובת הזו לא מורשית להתחברות. ${g('נסה', 'נסי', 'נסו')} מהאתר הרשמי`,
  'auth/captcha-check-failed': `הכתובת הזו לא מורשית להתחברות. ${g('נסה', 'נסי', 'נסו')} מהאתר הרשמי`,
  // Google refuses to text this number right now (blocked, unused or flagged number, or the project's SMS limit).
  'auth/error-code:-39': `לא ניתן לשלוח SMS למספר הזה כרגע. ${g('בדוק', 'בדקי', 'בדקו')} שהמספר נכון או ${g('נסה', 'נסי', 'נסו')} שוב מאוחר יותר`,
  'auth/missing-phone-number': 'צריך להזין מספר נייד',
  'auth/invalid-recaptcha-token': `בדיקת האבטחה של Google נכשלה. ${g('רענן', 'רענני', 'רעננו')} את הדף ${g('ונסה', 'ונסי', 'ונסו')} שוב`,
  'auth/missing-recaptcha-token': `בדיקת האבטחה של Google נכשלה. ${g('רענן', 'רענני', 'רעננו')} את הדף ${g('ונסה', 'ונסי', 'ונסו')} שוב`,
  'auth/recaptcha-not-enabled': `בדיקת האבטחה של Google נכשלה. ${g('רענן', 'רענני', 'רעננו')} את הדף ${g('ונסה', 'ונסי', 'ונסו')} שוב`,
  'permission-denied': 'אין הרשאה לפעולה הזו',
  unavailable: 'אין חיבור לאינטרנט',
};
/** Firebase errors in Hebrew; our own (already Hebrew) messages pass through. */
const friendly = (e: unknown) => {
  const code = (e as { code?: string }).code?.replace(/^firestore\//, '');
  if (code && ERRORS[code]) return new Error(ERRORS[code]);
  if (e instanceof Error && !code) return e;
  // Unknown: keep the code visible, so a screenshot says what actually failed.
  return new Error(`משהו השתבש, ${g('נסה', 'נסי', 'נסו')} שוב${code ? ` (${code.replace(/^auth\//, '')})` : ''}`);
};
const guard =
  <A extends unknown[], R>(fn: (...a: A) => Promise<R>) =>
  async (...a: A): Promise<R> => {
    try {
      return await fn(...a);
    } catch (e) {
      console.warn(e); // the raw Firebase code, for whoever opens the console
      throw friendly(e);
    }
  };

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;
/** Firestore rejects undefined values; keep documents clean. */
const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
const withoutId = <T extends { id: string }>({ id: _id, ...rest }: T) => clean(rest); // eslint-disable-line @typescript-eslint/no-unused-vars

export async function createFirebaseBackend(): Promise<Backend> {
  const app = initializeApp(FIREBASE.config);
  const auth = getAuth(app);
  auth.languageCode = 'he';
  const fs = initializeFirestore(app, { ignoreUndefinedProperties: true });
  const storage = getStorage(app);
  const emulator = import.meta.env.VITE_FIREBASE_EMULATOR as string | undefined;
  if (emulator) {
    connectAuthEmulator(auth, `http://${emulator}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(fs, emulator, 8080);
    connectStorageEmulator(storage, emulator, 9199);
  }

  const root = `shops/${FIREBASE.shopId}`;
  const col = (name: string) => collection(fs, root, name);
  const settingsRef = doc(fs, root, 'meta', 'settings');
  const dayRef = (date: DateKey) => doc(fs, root, 'days', date);
  const apptRef = (id: string) => doc(fs, root, 'appointments', id);
  const newId = (name: string) => doc(col(name)).id;

  // ---------------------------------------------------------------- live state
  let services: Service[] | null = null;
  let settings: Settings | null = null;
  let gallery: GalleryItem[] = [];
  let days = new Map<DateKey, BusyEntry[]>();
  let appointments: Appointment[] = [];
  let blocks: Block[] = [];
  let waitlist: WaitlistEntry[] = [];
  let session: Session | null = null;
  let user: User | null = null;

  const build = (): DbSnapshot => {
    const mine = new Set(appointments.map((a) => a.id));
    // Customers see other people's appointments only as anonymous busy ranges.
    const busyBlocks =
      session?.role === 'admin' ? blocks : [...days].flatMap(([date, list]) => list.filter((b) => !mine.has(b.id)).map((b) => ({ id: b.id, date, start: b.start, end: b.end })));
    return {
      services: services ?? DEFAULTS.services,
      settings: settings ?? DEFAULTS.settings,
      appointments,
      blocks: busyBlocks,
      waitlist,
      gallery,
    };
  };
  let db = build();
  const dbListeners = new Set<() => void>();
  const authListeners = new Set<() => void>();
  const emit = () => {
    db = build();
    dbListeners.forEach((l) => l());
  };

  const docs = <T>(snap: { docs: { id: string; data(): unknown }[] }) => snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T);

  // Public data, for everyone (also signed out). On a read error the screens keep the defaults from the shop config (shops/<id>/config.ts).
  const warn = (what: string) => (e: Error) => console.warn(`Firebase: could not load ${what}`, e.message);
  onSnapshot(col('services'), (s) => ((services = s.empty ? null : docs<Service>(s).sort(byOrder)), emit()), warn('services'));
  onSnapshot(settingsRef, (s) => ((settings = s.exists() ? (s.data() as Settings) : null), emit()), warn('settings'));
  onSnapshot(col('gallery'), (s) => ((gallery = docs<GalleryItem>(s).sort(byOrder)), emit()), warn('gallery'));

  // Data that depends on who is signed in.
  let scoped: Unsubscribe[] = [];
  const watchScoped = () => {
    scoped.forEach((u) => u());
    scoped = [];
    appointments = [];
    blocks = [];
    waitlist = [];
    days = new Map();
    const onErr = (e: Error) => (warn('your data')(e), emit());
    if (session?.role === 'admin') {
      scoped.push(onSnapshot(col('appointments'), (s) => ((appointments = docs<Appointment>(s)), emit()), onErr));
      scoped.push(onSnapshot(col('blocks'), (s) => ((blocks = docs<Block>(s)), emit()), onErr));
      scoped.push(onSnapshot(col('waitlist'), (s) => ((waitlist = docs<WaitlistEntry>(s)), emit()), onErr));
    } else {
      scoped.push(
        onSnapshot(
          query(col('days'), where(documentId(), '>=', todayKey())),
          (s) => ((days = new Map(s.docs.map((d) => [d.id, (d.data().busy ?? []) as BusyEntry[]]))), emit()),
          onErr,
        ),
      );
      if (session) {
        const mine = where('customerPhone', '==', session.phone);
        scoped.push(onSnapshot(query(col('appointments'), mine), (s) => ((appointments = docs<Appointment>(s)), emit()), onErr));
        scoped.push(onSnapshot(query(col('waitlist'), mine), (s) => ((waitlist = docs<WaitlistEntry>(s)), emit()), onErr));
      }
    }
    emit();
  };

  // ---------------------------------------------------------------- auth
  const setSession = (s: Session | null) => {
    const changedWho = s?.phone !== session?.phone || s?.role !== session?.role;
    session = s;
    authListeners.forEach((l) => l());
    if (changedWho) watchScoped();
  };

  const sessionFor = async (u: User): Promise<Session> => {
    const phone = fromIntl(u.phoneNumber ?? '');
    const role = ADMIN_PHONES.includes(phone) ? 'admin' : 'customer';
    const profile = await getDoc(doc(fs, root, 'users', u.uid)).catch(() => null);
    return { phone, role, name: (profile?.data()?.name as string | undefined) ?? null };
  };

  /** A brand-new project starts with the services and hours from the shop config (shops/<id>/config.ts), written by the first admin sign-in. */
  const seedIfEmpty = async () => {
    if ((await getDoc(settingsRef)).exists()) return;
    const batch = writeBatch(fs);
    batch.set(settingsRef, DEFAULTS.settings);
    for (const s of DEFAULTS.services) batch.set(doc(col('services'), s.id), withoutId(s));
    await batch.commit();
  };

  const ready = new Promise<void>((resolve) => {
    onAuthStateChanged(auth, async (u) => {
      user = u;
      const s = u?.phoneNumber ? await sessionFor(u) : null;
      setSession(s);
      if (s?.role === 'admin') seedIfEmpty().catch(() => {});
      resolve();
    });
  });

  let verifier: RecaptchaVerifier | null = null;
  let confirmation: ConfirmationResult | null = null;
  /** A reCAPTCHA token works once, so every code request gets a fresh invisible verifier. */
  const recaptcha = () => {
    verifier?.clear();
    document.getElementById('recaptcha')?.remove();
    const host = Object.assign(document.createElement('div'), { id: 'recaptcha' });
    document.body.appendChild(host);
    verifier = new RecaptchaVerifier(auth, host, { size: 'invisible' });
    return verifier;
  };

  const requireSession = () => {
    if (!session) throw new Error('צריך להתחבר קודם');
    return session;
  };
  const requireAdmin = () => {
    if (session?.role !== 'admin') throw new Error('פעולה למנהל בלבד');
  };
  const service = (id: string) => {
    const s = db.services.find((x) => x.id === id);
    if (!s) throw new Error('הטיפול לא נמצא');
    return s;
  };

  // ---------------------------------------------------------------- day ledger
  /** Reads a day's busy list inside a transaction (all reads must come before writes). */
  const readDay = async (t: Transaction, date: DateKey) => ((await t.get(dayRef(date))).data()?.busy ?? []) as BusyEntry[];
  /** Throws like the mock when [start, end) is not free on that day. */
  const checkFree = (date: DateKey, busy: BusyEntry[], start: Minutes, end: Minutes, ignoreId?: string) => {
    const view: DbSnapshot = { ...db, appointments: [], blocks: busy.filter((b) => b.id !== ignoreId).map((b) => ({ ...b, date })) };
    assertBookable(view, date, start, end);
  };

  /** Books into the day ledger and creates the appointment in one transaction, so two people can't take one slot. */
  const placeAppointment = async (appt: Omit<Appointment, 'id'>, replaces?: Appointment) => {
    const ref = doc(col('appointments'));
    await runTransaction(fs, async (t) => {
      const busy = await readDay(t, appt.date);
      const oldBusy = replaces && replaces.date !== appt.date ? await readDay(t, replaces.date) : null;
      checkFree(appt.date, busy, appt.start, appt.end, replaces?.id);
      const entry = { id: ref.id, start: appt.start, end: appt.end };
      let nextBusy = [...busy, entry];
      if (replaces) {
        const cancelled = { status: 'cancelled', cancelledAt: Date.now(), cancelledBy: 'customer', openingHandled: false };
        t.update(apptRef(replaces.id), cancelled);
        if (oldBusy) t.set(dayRef(replaces.date), { busy: oldBusy.filter((b) => b.id !== replaces.id) });
        else nextBusy = nextBusy.filter((b) => b.id !== replaces.id);
      }
      t.set(ref, clean(appt));
      t.set(dayRef(appt.date), { busy: nextBusy });
    });
    return { ...appt, id: ref.id } as Appointment;
  };

  const cancelIn = async (t: Transaction, a: Appointment, by: 'customer' | 'admin', openingHandled: boolean) => {
    const busy = await readDay(t, a.date);
    return () => {
      t.update(apptRef(a.id), { status: 'cancelled', cancelledAt: Date.now(), cancelledBy: by, openingHandled });
      t.set(dayRef(a.date), { busy: busy.filter((b) => b.id !== a.id) });
    };
  };

  const appointment = (id: string) => {
    const a = db.appointments.find((x) => x.id === id);
    if (!a) throw new Error('התור לא נמצא');
    return a;
  };

  // ---------------------------------------------------------------- the contract
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
      sendCode: guard(async (phone) => {
        confirmation = await signInWithPhoneNumber(auth, '+' + toIntl(phone), recaptcha());
      }),
      verifyCode: guard(async (_phone, code) => {
        if (!confirmation) throw new Error(`${g('שלח', 'שלחי', 'שלחו')} קוד קודם`);
        const { user: u } = await confirmation.confirm(code);
        confirmation = null;
        const s = await sessionFor(u);
        setSession(s);
        if (s.role === 'admin') await seedIfEmpty();
        return s;
      }),
      saveName: guard(async (name) => {
        const s = requireSession();
        const clean = name.trim();
        await setDoc(doc(fs, root, 'users', user!.uid), { name: clean, phone: s.phone }, { merge: true });
        setSession({ ...s, name: clean });
      }),
      signOut: guard(async () => {
        await signOut(auth);
      }),
    },

    appointments: {
      book: guard(async (input: BookingInput) => {
        const me = requireSession();
        const replaces = input.replacesId ? appointment(input.replacesId) : undefined;
        const svc = service(input.serviceId);
        assertWithinBookingWindow(input.date, BOOKING_MONTHS);
        const appt = await placeAppointment(
          {
            date: input.date,
            start: input.start,
            end: input.start + svc.durationMin,
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
          },
          replaces,
        );
        // Booking a day you were waiting on removes you from that day's waitlist.
        await Promise.all(db.waitlist.filter((w) => w.date === input.date && w.customerPhone === me.phone).map((w) => deleteDoc(doc(col('waitlist'), w.id))));
        return appt;
      }),
      addWalkIn: guard(async (input: WalkInInput) => {
        requireAdmin();
        const svc = service(input.serviceId);
        return placeAppointment({
          date: input.date,
          start: input.start,
          end: input.start + svc.durationMin,
          serviceId: svc.id,
          serviceName: svc.name,
          price: svc.price,
          customerName: input.customerName?.trim() || 'לקוח מזדמן',
          phone: phoneDigits(input.phone ?? ''),
          notes: input.notes?.trim() || undefined,
          status: 'booked',
          source: 'walkin',
          createdAt: Date.now(),
        });
      }),
      cancel: guard(async (id) => {
        const s = requireSession();
        const a = appointment(id);
        await runTransaction(fs, async (t) => (await cancelIn(t, a, s.role, false))());
      }),
      markOpeningHandled: guard(async (id) => {
        requireAdmin();
        await updateDoc(apptRef(id), { openingHandled: true });
      }),
    },

    blocks: {
      add: guard(async (date, start, end, label) => {
        requireAdmin();
        const ref = doc(col('blocks'));
        const block: Block = clean({ id: ref.id, date, start, end, label });
        await runTransaction(fs, async (t) => {
          const busy = await readDay(t, date);
          t.set(ref, withoutId(block));
          t.set(dayRef(date), { busy: [...busy, { id: ref.id, start, end }] });
        });
        return block;
      }),
      update: guard(async (id, range) => {
        requireAdmin();
        const b = db.blocks.find((x) => x.id === id);
        if (!b) throw new Error('החסימה לא נמצאה');
        await runTransaction(fs, async (t) => {
          const busy = await readDay(t, b.date);
          t.update(doc(col('blocks'), id), { start: range.from, end: range.to });
          t.set(dayRef(b.date), { busy: busy.map((x) => (x.id === id ? { id, start: range.from, end: range.to } : x)) });
        });
      }),
      remove: guard(async (id) => {
        requireAdmin();
        const b = db.blocks.find((x) => x.id === id);
        if (!b) return;
        await runTransaction(fs, async (t) => {
          const busy = await readDay(t, b.date);
          t.delete(doc(col('blocks'), id));
          t.set(dayRef(b.date), { busy: busy.filter((x) => x.id !== id) });
        });
      }),
    },

    waitlist: {
      join: guard(async (date, part, name, phone) => {
        const mine = requireSession().phone;
        const batch = writeBatch(fs);
        for (const w of db.waitlist.filter((x) => x.date === date && x.customerPhone === mine)) batch.delete(doc(col('waitlist'), w.id));
        batch.set(doc(col('waitlist')), { date, part, name, phone: phoneDigits(phone), customerPhone: mine, createdAt: Date.now() });
        await batch.commit();
      }),
      leave: guard(async (id) => {
        requireSession();
        await deleteDoc(doc(col('waitlist'), id));
      }),
    },

    services: {
      add: guard(async (input) => {
        requireAdmin();
        const s: Service = { ...input, id: newId('services'), order: Math.max(-1, ...db.services.map((x) => x.order)) + 1 };
        await setDoc(doc(col('services'), s.id), withoutId(s));
        return s;
      }),
      update: guard(async (id, patch) => {
        requireAdmin();
        await updateDoc(doc(col('services'), id), clean(patch));
      }),
      remove: guard(async (id) => {
        requireAdmin();
        await deleteDoc(doc(col('services'), id));
      }),
      restore: guard(async (s) => {
        requireAdmin();
        await setDoc(doc(col('services'), s.id), withoutId(s));
      }),
    },

    settings: {
      setHours: guard(async (weekdays, hours) => {
        requireAdmin();
        const next = { ...db.settings.hours };
        for (const d of weekdays) next[d] = { ...hours };
        await setDoc(settingsRef, { ...db.settings, hours: next });
      }),
      setBreak: guard(async (range) => {
        requireAdmin();
        await setDoc(settingsRef, { ...db.settings, breakTime: range });
      }),
      addVacation: guard(async (from, to) => {
        requireAdmin();
        if (to < from) throw new Error('יום הסוף לפני יום ההתחלה');
        const v = { id: newId('vacations'), from, to };
        // Appointments in the vacation are cancelled; the admin is offered to message each client.
        const affected = db.appointments.filter((a) => a.status === 'booked' && a.date >= from && a.date <= to);
        await runTransaction(fs, async (t) => {
          const dates = [...new Set(affected.map((a) => a.date))];
          const busy = new Map(await Promise.all(dates.map(async (d) => [d, await readDay(t, d)] as const)));
          for (const a of affected) t.update(apptRef(a.id), { status: 'cancelled', cancelledAt: Date.now(), cancelledBy: 'admin', openingHandled: true });
          for (const d of dates) t.set(dayRef(d), { busy: busy.get(d)!.filter((b) => !affected.some((a) => a.id === b.id)) });
          t.set(settingsRef, { ...db.settings, vacations: [...db.settings.vacations, v] });
        });
        return v;
      }),
      removeVacation: guard(async (id) => {
        requireAdmin();
        await setDoc(settingsRef, { ...db.settings, vacations: db.settings.vacations.filter((v) => v.id !== id) });
      }),
    },

    gallery: {
      upload: guard(async (photo, category) => {
        requireAdmin();
        if (!photo.type.startsWith('image/')) throw new Error('אפשר להעלות רק תמונות');
        const id = newId('gallery');
        const file = ref(storage, `${root}/gallery/${id}.jpg`);
        await uploadBytes(file, photo, { contentType: photo.type, cacheControl: 'public, max-age=31536000' });
        const item: GalleryItem = { id, src: await getDownloadURL(file), category, pinned: false, order: Math.min(0, ...db.gallery.map((g) => g.order)) - 1 };
        await setDoc(doc(col('gallery'), id), withoutId(item));
        return item;
      }),
      togglePin: guard(async (id) => {
        requireAdmin();
        const g = db.gallery.find((x) => x.id === id);
        if (g) await updateDoc(doc(col('gallery'), id), { pinned: !g.pinned });
      }),
      // The photo file stays in Storage so "ביטול" can bring the item back.
      remove: guard(async (id) => {
        requireAdmin();
        await deleteDoc(doc(col('gallery'), id));
      }),
      restore: guard(async (item) => {
        requireAdmin();
        await setDoc(doc(col('gallery'), item.id), withoutId(item));
      }),
    },
  };

  await ready;
  return backend;
}
