// Fills the live Firestore with made-up bookings for the rest of the month, or removes them again.
// Every made-up appointment carries demo: true, so `remove` deletes exactly those and nothing real.
//   npx vite-node scripts/demo-data.ts add      (needs GOOGLE_APPLICATION_CREDENTIALS, see .github/workflows/demo-data.yml)
//   npx vite-node scripts/demo-data.ts remove
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import shop from '../shop.config';
import { dayStatus, hoursFor, slotsFor } from '../src/domain/schedule';
import type { Appointment, Block, DbSnapshot, Service, Settings } from '../src/domain/types';
import { addDays, todayKey } from '../src/lib/time';

const FIRST = ['יוסי', 'דניאל', 'משה', 'רון', 'אלון', 'שי', 'עומר', 'נתנאל', 'ליאור', 'אבי', 'איתי', 'עידן', 'אורי', 'מתן', 'יונתן', 'אליה', 'תומר', 'גיא', 'עמית', 'נועם'];
const LAST = ['לוי', 'כהן', 'אזולאי', 'ביטון', 'פרץ', 'גבאי', 'דהן', 'אוחיון', 'חדד', 'מזרחי', 'שושן', 'אברהם', 'פרידמן', 'מלכה', 'עמר'];
const NOTES = ['קצר בצדדים, להשאיר אורך למעלה', 'פייד נמוך', 'רק לסדר את הזקן', 'כמו בפעם הקודמת'];
const pick = <T>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

type Busy = { id: string; start: number; end: number };

const action = process.argv[2];
if (action !== 'add' && action !== 'remove') throw new Error('usage: demo-data.ts add|remove');

initializeApp({ credential: applicationDefault(), projectId: shop.firebase.projectId });
const fs = getFirestore();
const root = fs.doc(`shops/${shop.shopId}`);
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

async function add() {
  const settings = (await root.collection('meta').doc('settings').get()).data() as Settings | undefined;
  const services = docs<Service>(await col('services').get()).sort((a, b) => a.order - b.order);
  if (!settings || !services.length) throw new Error('No settings or services yet: sign in once as the admin first.');
  const appointments = docs<Appointment>(await col('appointments').get());
  const blocks = docs<Block>(await col('blocks').get());

  const now = new Date();
  const today = todayKey(now);
  const monthEnd = todayKey(new Date(now.getFullYear(), now.getMonth() + 1, 0));
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
        customerName: `${pick(FIRST)} ${pick(LAST)}`,
        phone,
        customerPhone: phone,
        ...(Math.random() < 0.25 && { notes: pick(NOTES) }),
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
