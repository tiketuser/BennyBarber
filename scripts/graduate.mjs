// Moves a barber from the shared trial project to his own app, in two runs of the same command:
//   node scripts/graduate.mjs <slug> <id>
// 1. No shops/<id> yet: creates it (like npm run new-shop) from his trialShops/{slug} document, with the services and
//    hours he set during the trial. Then create his Firebase project the usual way (shops/README.md) and fill its config.
// 2. shops/<id> has backend 'firebase': copies everything under shops/{slug} in the trial project (appointments,
//    customers, gallery, settings) to shops/{id} in his project. Refuses if that shop already has settings.
// Needs GOOGLE_APPLICATION_CREDENTIALS with access to both projects. Run by the "Graduate trial shop" workflow.
// Customers sign in again once in the new app (sign-ins don't move between projects); their bookings do.
import { existsSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import trial from '../shops/trial/config.ts';
import { isSlug, toShopConfig } from '../src/trial/trialDoc.ts';

const [slug, id] = process.argv.slice(2);
if (!slug || !isSlug(slug) || !id || !/^[a-z][a-z0-9]*$/.test(id)) throw new Error('usage: node scripts/graduate.mjs <trial slug> <new shop id: lowercase latin and digits>');

const credential = applicationDefault();
const trialDb = getFirestore(initializeApp({ credential, projectId: trial.firebase.projectId }, 'trial'));
const from = trialDb.doc(`shops/${slug}`);
const node = (script, env = {}) => execSync(`node --experimental-strip-types --no-warnings ${script}`, { stdio: 'inherit', env: { ...process.env, ...env } });

if (!existsSync(`shops/${id}`)) {
  const snap = await trialDb.doc(`trialShops/${slug}`).get();
  if (!snap.exists) throw new Error(`No trial shop "${slug}"`);
  const doc = { ...snap.data(), trialEndsAt: undefined, createdAt: undefined };
  // What he set up during the trial wins over the document's starting defaults.
  const settings = (await from.collection('meta').doc('settings').get()).data();
  const services = (await from.collection('services').get()).docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.order - b.order);
  const shop = toShopConfig(trial, doc, id);
  const defaults = { services: services.length ? services : shop.defaults.services, settings: settings ?? shop.defaults.settings };

  node(`scripts/new-shop.mjs ${id}`);
  const file = `shops/${id}/config.ts`;
  const fields = {
    brand: shop.brand,
    fullName: shop.fullName,
    kind: shop.kind,
    audience: shop.audience,
    place: shop.place,
    tagline: shop.tagline,
    address: shop.address,
    phone: shop.phone,
    // Without the trial contact: he was only there to help during the trial.
    adminPhones: shop.adminPhones.filter((p) => p.replace(/\D/g, '') !== trial.trial.contactPhone.replace(/\D/g, '')),
    instagram: shop.instagram,
    course: shop.course,
    bookingMonthsAhead: shop.bookingMonthsAhead,
    colors: shop.colors,
    appId: `il.co.${id}.barber`,
    backend: 'demo',
    shopId: id,
    firebase: {
      apiKey: '',
      authDomain: `barber-${id}.firebaseapp.com`,
      projectId: `barber-${id}`,
      storageBucket: `barber-${id}.firebasestorage.app`,
      messagingSenderId: '',
      appId: '',
    },
    defaults,
  };
  const body = Object.entries(fields)
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v, null, 2).replace(/\n/g, '\n  ')},`)
    .join('\n');
  writeFileSync(
    file,
    `import { defineShop } from '../types.ts';\n\n// From the trial shop "${slug}" (scripts/graduate.mjs). backend stays 'demo' until his Firebase project's config is below.\nexport default defineShop({\n${body}\n});\n`,
  );
  execSync(`npx prettier --write ${file}`, { stdio: 'inherit' });
  node('scripts/make-icons.mjs', { SHOP: id });
  console.log(`\nCreated shops/${id} from trial "${slug}". Next: his Firebase project (shops/README.md), then run this again to copy the data.`);
} else {
  const target = (await import(`../shops/${id}/config.ts`)).default;
  if (target.backend !== 'firebase') throw new Error(`shops/${id} has no Firebase project yet (backend: '${target.backend}')`);
  const toDb = getFirestore(initializeApp({ credential, projectId: target.firebase.projectId }, 'shop'));
  const to = toDb.doc(`shops/${id}`);
  if ((await to.collection('meta').doc('settings').get()).exists) throw new Error(`shops/${id} in ${target.firebase.projectId} already has data; not copying over it`);
  let count = 0;
  for (const col of await from.listCollections()) {
    const docs = (await col.get()).docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = toDb.batch();
      for (const d of docs.slice(i, i + 400)) batch.set(to.collection(col.id).doc(d.id), d.data());
      await batch.commit();
    }
    count += docs.length;
    console.log(`${col.id}: ${docs.length}`);
  }
  console.log(`Copied ${count} documents from ${trial.firebase.projectId}/shops/${slug} to ${target.firebase.projectId}/shops/${id}.`);
}
