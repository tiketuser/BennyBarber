// Writes one barber's free-trial shop into the shared trial project (Firestore trialShops/{slug}); his app is then live at
// https://<trial site>/<slug>. Run by the "Create trial shop" workflow, which the outreach automation (n8n) triggers.
// Usage: SLUG=<slug> CONFIG='<json>' node scripts/create-trial.mjs   (needs GOOGLE_APPLICATION_CREDENTIALS)
// CONFIG is the trialShops document (shape: src/trial/trialDoc.ts). A new shop needs only what changes from barber to
// barber (brand, phone, city...); the rest gets the usual values below, trialEndsAt 30 days from now and his own
// address barber-<slug>.web.app (scripts/trial-sites.mjs; if it can't be had, <main site>/<slug>).
// Running it again for the same slug changes only the fields CONFIG names; the others stay as they are.
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import trial from '../shops/trial/config.ts';
import { isSlug } from '../src/trial/trialDoc.ts';
import { ensureSite, isSiteId } from './trial-sites.mjs';

const slug = (process.env.SLUG ?? '').trim().toLowerCase();
if (!isSlug(slug)) throw new Error(`Bad slug "${slug}": lowercase latin letters, digits and dashes, 2-60 long`);
const input = JSON.parse(process.env.CONFIG ?? '');

/** What every new trial shop starts with unless CONFIG says otherwise. */
const USUAL = {
  kind: 'ברברשופ',
  place: 'המספרה',
  audience: 'men',
  tagline: '',
  instagram: null,
  colors: { brand: '#111111', accent: '#D4AF6A' },
  course: { enabled: false, details: '' },
  bookingMonthsAhead: 3,
  galleryUrls: [],
  source: 'manual',
};

const digits = (p) => String(p).replace(/\D/g, '');
const e164 = (p) => '+972' + digits(p).replace(/^(972|0)/, '');
initializeApp({ credential: applicationDefault(), projectId: trial.firebase.projectId });
const db = getFirestore();
const existing = db.doc(`trialShops/${slug}`);
const before = await existing.get();
const now = new Date();

const doc = { ...(before.exists ? before.data() : { ...USUAL, siteId: `barber-${slug}`.slice(0, 30).replace(/-+$/, '') }), ...input };
doc.fullName ??= doc.brand;
doc.address = { street: '', city: '', ...doc.address };
if (typeof doc.brand !== 'string' || !doc.brand.trim()) throw new Error('CONFIG needs brand');
if (typeof doc.phone !== 'string' || !doc.phone.trim()) throw new Error('CONFIG needs phone');
delete doc.adminPhonesE164;

// The trial's contact (Aviv) is always an admin too, so he can set the shop up with the barber.
const adminPhones = [...new Set([...(doc.adminPhones ?? []), trial.trial.contactPhone].map(digits))].map((d) => (d.startsWith('972') ? '0' + d.slice(3) : d));
const when = (v, fallback) => {
  const d = v ? new Date(v) : fallback;
  if (Number.isNaN(d.getTime())) throw new Error(`Bad date "${v}"`);
  return Timestamp.fromDate(d);
};

// His own site, unless the id is someone else's here already or Firebase refuses it.
let siteId = before.get('siteId') ?? null;
if (doc.siteId !== undefined && doc.siteId !== siteId) {
  const wanted = String(doc.siteId).trim().toLowerCase();
  const owner = isSiteId(wanted) ? (await db.doc(`trialSites/${wanted}`).get()).get('slug') : null;
  const why = !isSiteId(wanted) ? 'not a valid site id (6-30 lowercase latin, digits, dashes)' : owner && owner !== slug ? `already used by ${owner}` : await ensureSite(wanted);
  if (why) console.log(`::warning::No own site "${wanted}" for ${slug}: ${why}`);
  else {
    await db.doc(`trialSites/${wanted}`).set({ slug });
    siteId = wanted;
  }
}
delete doc.siteId;

await existing.set({
  ...doc,
  ...(siteId && { siteId }),
  slug,
  adminPhones,
  adminPhonesE164: adminPhones.map(e164),
  // A re-run keeps the original dates unless CONFIG sets them.
  createdAt: when(input.createdAt, before.get('createdAt')?.toDate() ?? now),
  trialEndsAt: when(input.trialEndsAt, before.get('trialEndsAt')?.toDate() ?? new Date(now.getTime() + 30 * 24 * 3600 * 1000)),
});
// His name and logo in the site's link preview (also after a rename or a new logo).
if (siteId) {
  const why = await ensureSite(siteId, slug, (await existing.get()).data());
  if (why) console.log(`::warning::Site ${siteId} not refreshed: ${why}`);
}
const url = siteId ? `https://${siteId}.web.app` : `https://${trial.firebase.projectId}.web.app/${slug}`;
console.log(`${before.exists ? 'Updated' : 'Created'} trial shop ${slug}: ${url}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${url}\n`);
}
