// Fills the live Firestore with made-up bookings for the rest of the month (DAYS=n: the next n days), or removes them.
// Every made-up appointment carries demo: true, so `remove` deletes exactly those and nothing real.
//   npx vite-node scripts/demo-data.ts add      (needs GOOGLE_APPLICATION_CREDENTIALS, see .github/workflows/demo-data.yml)
//   npx vite-node scripts/demo-data.ts remove
// Trial shops: SHOP=trial SLUG=<slug>. A trial shop nobody signed in to yet gets its starting services and hours first.
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import { SHOPS } from '../shops/index.ts';
import { toShopConfig, type TrialDoc } from '../src/trial/trialDoc';
import { dayStatus, hoursFor, slotsFor } from '../src/domain/schedule';
import type { Appointment, Block, DbSnapshot, Service, Settings } from '../src/domain/types';
import { addDays, todayKey } from '../src/lib/time';

const FEMALE = ['נועה', 'מיכל', 'שירה', 'יעל', 'תמר', 'מאיה', 'הדר', 'רוני', 'ליאת', 'אורטל', 'שני', 'דנה', 'מורן', 'עדי', 'קרן', 'אביטל'];
const FIRST = ['יוסי', 'דניאל', 'משה', 'רון', 'אלון', 'שי', 'עומר', 'נתנאל', 'ליאור', 'אבי', 'איתי', 'עידן', 'אורי', 'מתן', 'יונתן', 'אליה', 'תומר', 'גיא', 'עמית', 'נועם'];
const LAST = ['לוי', 'כהן', 'אזולאי', 'ביטון', 'פרץ', 'גבאי', 'דהן', 'אוחיון', 'חדד', 'מזרחי', 'שושן', 'אברהם', 'פרידמן', 'מלכה', 'עמר'];
const NOTES = ['קצר בצדדים, להשאיר אורך למעלה', 'פייד נמוך', 'רק לסדר את הזקן', 'כמו בפעם הקודמת'];
const pick = <T>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

type Busy = { id: string; start: number; end: number };

const action = process.argv[2];
if (action !== 'add' && action !== 'remove') throw new Error('usage: demo-data.ts add|remove');

// Not via shop.config: in vite-node that resolves to the trial build's browser loader.
const shop = SHOPS[(process.env.SHOP || 'bennycohen') as keyof typeof SHOPS];
const slug = shop.trial ? process.env.SLUG : shop.shopId;
if (!slug) throw new Error('Trial shops need SLUG=<slug>');
const days = Number(process.env.DAYS) || 0;

initializeApp({ credential: applicationDefault(), projectId: shop.firebase.projectId });
const fs = getFirestore();
const root = fs.doc(`shops/${slug}`);
const col = (name: string) => root.collection(name);
const dayRef = (date: string) => col('days').doc(date);
const docs = <T>(snap: FirebaseFirestore.QuerySnapshot) => snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T);

/** Commits in chunks under Firestore's 500-writes limit. */
async function commit(ops: ((b: FirebaseFirestore.WriteBatch) => void)[]) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = fs.batch();
    ops.slice(i, i + 400).forEach((op) => op(batch));
    await batch.commit();
  }
}

async function remove() {
  const demo = docs<Appointment>(await col('appointments').where('demo', '==', true).get());
  const ids = new Set(demo.map((a) => a.id));
  const dates = [...new Set(demo.map((a) => a.date))];
  const ops: ((b: FirebaseFirestore.WriteBatch) => void)[] = demo.map((a) => (b) => b.delete(col('appointments').doc(a.id)));
  for (const date of dates) {
    const busy = ((await dayRef(date).get()).data()?.busy ?? []) as Busy[];
    ops.push((b) => b.set(dayRef(date), { busy: busy.filter((x) => !ids.has(x.id)) }));
  }
  await commit(ops);
  console.log(`removed ${demo.length} demo appointments`);
}

/** Women's services ("פן", "צבע", "החלקה"...) get women's names; in a women's shop everyone does. */
const isWomens = (svc: Service) => shop.audience === 'women' || /אישה|נשים|פן|צבע|החלקה|גוונים|בייביליס|תסרוקת|בלונד|בליאז|קרטין/.test(svc.name);

/** What the admin's first sign-in would write (firebaseBackend seedIfEmpty), for a trial shop nobody signed in to yet. */
async function seedTrialShop() {
  const doc = (await fs.doc(`trialShops/${slug}`).get()).data();
  if (!doc) throw new Error(`No trial shop "${slug}"`);
  const config = toShopConfig(shop, { ...doc, trialEndsAt: undefined, createdAt: undefined } as unknown as TrialDoc, slug!);
  await commit([
    (b) => b.set(root.collection('meta').doc('settings'), config.defaults.settings),
    ...config.defaults.services.map(
      ({ id, ...s }) =>
        (b: FirebaseFirestore.WriteBatch) =>
          b.set(col('services').doc(id), s),
    ),
    ...(config.galleryUrls ?? []).map(
      (src, i) => (b: FirebaseFirestore.WriteBatch) => b.set(col('gallery').doc(`starter-${i}`), { src, category: 'haircut', pinned: i < 4, order: i }),
    ),
  ]);
  console.log(`seeded ${slug} with its starting services and hours`);
}

async function add() {
  if (shop.trial && !(await root.collection('meta').doc('settings').get()).exists) await seedTrialShop();
  const settings = (await root.collection('meta').doc('settings').get()).data() as Settings | undefined;
  const services = docs<Service>(await col('services').get()).sort((a, b) => a.order - b.order);
  if (!settings || !services.length) throw new Error('No settings or services yet: sign in once as the admin first.');
  const appointments = docs<Appointment>(await col('appointments').get());
  const blocks = docs<Block>(await col('blocks').get());

  const now = new Date();
  const today = todayKey(now);
  const monthEnd = days ? addDays(today, days - 1) : todayKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const ops: ((b: FirebaseFirestore.WriteBatch) => void)[] = [];
  let added = 0;

  for (let date = today; date <= monthEnd; date = addDays(date, 1)) {
    const day: DbSnapshot = { services, settings, appointments: appointments.filter((a) => a.date === date), blocks, waitlist: [], gallery: [] };
    const busy = ((await dayRef(date).get()).data()?.busy ?? []) as Busy[];
    const density = 0.5 + Math.random() * 0.35;
    const h = hoursFor(settings, date);
    if (!h || dayStatus(day, date, 20, now) === 'vacation') continue;
    for (let guard = 0; guard < 40; guard++) {
      const svc = Math.random() < 0.4 ? (services.find((s) => s.popular) ?? services[0]) : pick(services);
      const free = slotsFor(day, date, svc.durationMin, now).filter((s) => s.available);
      const filled = day.appointments.filter((a) => a.status === 'booked').reduce((t, a) => t + (a.end - a.start), 0);
      if (!free.length || filled / (h.to - h.from) >= density) break;
      const slot = pick(free);
      const ref: DocumentReference = col('appointments').doc();
      const phone = '05' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
      const appt: Omit<Appointment, 'id'> & { demo: true } = {
        date,
        start: slot.start,
        end: slot.start + svc.durationMin,
        serviceId: svc.id,
        serviceName: svc.name,
        price: svc.price,
        customerName: `${pick(isWomens(svc) ? FEMALE : FIRST)} ${pick(LAST)}`,
        phone,
        customerPhone: phone,
        ...(Math.random() < 0.25 && !isWomens(svc) && { notes: pick(NOTES) }),
        status: 'booked',
        source: Math.random() < 0.15 ? 'walkin' : 'app',
        createdAt: now.getTime() - Math.floor(Math.random() * 10) * 86400000,
        demo: true,
      };
      day.appointments.push({ ...appt, id: ref.id });
      busy.push({ id: ref.id, start: appt.start, end: appt.end });
      ops.push((b) => b.set(ref, appt));
      added++;
    }
    ops.push((b) => b.set(dayRef(date), { busy }));
  }
  await commit(ops);
  console.log(`added ${added} demo appointments from ${today} to ${monthEnd}`);
}

await (action === 'add' ? add() : remove());
