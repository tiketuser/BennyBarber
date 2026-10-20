// Writes one barber's free-trial shop into the shared trial project (Firestore trialShops/{slug}); his app is then live at
// https://<trial site>/<slug>. Run by the "Create trial shop" workflow, which the outreach automation (n8n) triggers.
// Usage: SLUG=<slug> CONFIG='<json>' node scripts/create-trial.mjs   (needs GOOGLE_APPLICATION_CREDENTIALS)
// CONFIG is the trialShops document (shape: src/trial/trialDoc.ts). Missing: adminPhonesE164 (from adminPhones),
// createdAt (now) and trialEndsAt (7 days from now). Running it again for the same slug updates the shop.
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import trial from '../shops/trial/config.ts';
import { isSlug } from '../src/trial/trialDoc.ts';

const slug = (process.env.SLUG ?? '').trim().toLowerCase();
if (!isSlug(slug)) throw new Error(`Bad slug "${slug}": lowercase latin letters, digits and dashes, 2-60 long`);
const doc = JSON.parse(process.env.CONFIG ?? '');
if (typeof doc.brand !== 'string' || !doc.brand.trim()) throw new Error('CONFIG needs brand');
if (typeof doc.phone !== 'string' || !doc.phone.trim()) throw new Error('CONFIG needs phone');

const digits = (p) => String(p).replace(/\D/g, '');
const e164 = (p) => '+972' + digits(p).replace(/^(972|0)/, '');
// The trial's contact (Aviv) is always an admin too, so he can set the shop up with the barber.
const adminPhones = [...new Set([...(doc.adminPhones ?? []), trial.trial.contactPhone].map(digits))].map((d) => (d.startsWith('972') ? '0' + d.slice(3) : d));
const when = (v, fallback) => {
  const d = v ? new Date(v) : fallback;
  if (Number.isNaN(d.getTime())) throw new Error(`Bad date "${v}"`);
  return Timestamp.fromDate(d);
};

initializeApp({ credential: applicationDefault(), projectId: trial.firebase.projectId });
const existing = getFirestore().doc(`trialShops/${slug}`);
const before = await existing.get();
const now = new Date();
await existing.set({
  ...doc,
  slug,
  adminPhones,
  adminPhonesE164: adminPhones.map(e164),
  // A re-run keeps the original dates unless CONFIG sets them.
  createdAt: when(doc.createdAt, before.get('createdAt')?.toDate() ?? now),
  trialEndsAt: when(doc.trialEndsAt, before.get('trialEndsAt')?.toDate() ?? new Date(now.getTime() + 7 * 24 * 3600 * 1000)),
});
const url = `https://${trial.firebase.projectId}.web.app/${slug}`;
console.log(`${before.exists ? 'Updated' : 'Created'} trial shop ${slug}: ${url}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${url}\n`);
}
