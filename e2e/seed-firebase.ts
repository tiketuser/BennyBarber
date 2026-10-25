// Fills the Firestore emulator with the same sample data as the demo, so e2e/run.mjs can drive Firebase too.
// Usage (emulators running): npx vite-node e2e/seed-firebase.ts
import shop from '../shop.config';
import { buildSeed } from '../src/data/mock/seed';

const PROJECT = shop.firebase.projectId;
const BASE = `http://localhost:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const ROOT = `projects/${PROJECT}/databases/(default)/documents/shops/${shop.shopId}`;

type Value = Record<string, unknown>;
const enc = (v: unknown): Value => {
  if (v === null) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  return { mapValue: { fields: fields(v as object) } };
};
const fields = (o: object) =>
  Object.fromEntries(
    Object.entries(o)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, enc(v)]),
  );

const writes: object[] = [];
const put = (path: string, data: object) => writes.push({ update: { name: `${ROOT}/${path}`, fields: fields(data) } });

const db = buildSeed();
const strip = <T extends { id: string }>({ id: _id, ...rest }: T) => rest; // eslint-disable-line @typescript-eslint/no-unused-vars
put('meta/settings', db.settings);
for (const s of db.services) put(`services/${s.id}`, strip(s));
for (const a of db.appointments) put(`appointments/${a.id}`, strip(a));
for (const b of db.blocks) put(`blocks/${b.id}`, strip(b));
for (const w of db.waitlist) put(`waitlist/${w.id}`, strip(w));
for (const g of db.gallery) put(`gallery/${g.id}`, strip(g));
const days = new Map<string, { id: string; start: number; end: number }[]>();
for (const x of [...db.appointments.filter((a) => a.status === 'booked'), ...db.blocks]) {
  days.set(x.date, [...(days.get(x.date) ?? []), { id: x.id, start: x.start, end: x.end }]);
}
for (const [date, busy] of days) put(`days/${date}`, { busy });

for (let i = 0; i < writes.length; i += 400) {
  const res = await fetch(`${BASE}:commit`, {
    method: 'POST',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes: writes.slice(i, i + 400) }),
  });
  if (!res.ok) throw new Error(`seed failed: ${res.status} ${await res.text()}`);
}
console.log(`seeded ${writes.length} documents`);
