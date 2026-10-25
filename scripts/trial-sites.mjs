// Each trial barber's own address, <siteId>.web.app: a Firebase Hosting site inside the trial project that serves the
// same trial build as the main site. The app finds the shop from the hostname (trialSites/{siteId} -> slug).
// Free plan limits: 36 sites per project, so expired trials lose their site (cleanup); <main>/<slug> always works.
//   node scripts/trial-sites.mjs sync      publish the main site's live build to every trial site (after each deploy)
//   node scripts/trial-sites.mjs cleanup   delete the sites of trials that ended 7+ days ago and didn't graduate
// Needs GOOGLE_APPLICATION_CREDENTIALS (the deploy service account, "Firebase Admin" on the trial project).
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { GoogleAuth } from 'google-auth-library';
import { shareDescription, withShareMeta } from '../shops/share.ts';
import trial from '../shops/trial/config.ts';
import { toShopConfig } from '../src/trial/trialDoc.ts';

export const PROJECT = trial.firebase.projectId;
const HOSTING = 'https://firebasehosting.googleapis.com/v1beta1';
const AUTH_CONFIG = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config`;

/** Lowercase latin, digits and dashes, 6-30 long, no dash at either end (Firebase Hosting site ids). */
export const isSiteId = (s) => typeof s === 'string' && /^[a-z0-9][a-z0-9-]{4,28}[a-z0-9]$/.test(s);

let client;
/** The API's answer, or { error: { code, message } } instead of throwing. */
async function api(url, method = 'GET', data, headers) {
  try {
    client ??= await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
    return (await client.request({ url, method, data, headers })).data ?? {};
  } catch (e) {
    return { error: { code: e.response?.status ?? 0, message: e.response?.data?.error?.message ?? e.message } };
  }
}

async function waitFor(op) {
  for (let i = 0; !op.done && !op.error; i++) {
    if (i > 60) return { error: { message: 'timed out waiting for ' + op.name } };
    await new Promise((r) => setTimeout(r, 2000));
    op = await api(`${HOSTING}/${op.name}`);
  }
  return op.error ? { error: op.error } : op.response;
}

/** The build the main trial site serves now. */
async function liveVersion() {
  const r = await api(`${HOSTING}/sites/${PROJECT}/channels/live`);
  return r.release?.version?.name ?? null;
}

/**
 * Copies the main site's live build to this site and releases it. With the barber's trialShops doc, the site's
 * index.html gets his name and logo, so a shared link previews as his shop (WhatsApp reads only the static HTML).
 */
async function publish(siteId, version, slug, doc) {
  let page = null;
  if (doc) {
    page = await sharePage(siteId, version, slug, doc).catch((e) => ({ error: { message: e.message } }));
    if (page.error) console.log(siteId, `link preview skipped: ${page.error.message}`);
  }
  const custom = page && !page.error;
  const cloned = await waitFor(await api(`${HOSTING}/sites/${siteId}/versions:clone`, 'POST', { sourceVersion: version, finalize: !custom }));
  if (cloned.error) return cloned;
  if (custom) {
    const done = await replaceIndex(cloned.name, page);
    if (done.error) {
      console.log(siteId, `link preview skipped: ${done.error.message}`);
      return publish(siteId, version);
    }
  }
  return api(`${HOSTING}/sites/${siteId}/releases?versionName=${encodeURIComponent(cloned.name)}`, 'POST', {});
}

/** The main site's index.html with this barber's title, description and logo, gzipped as Hosting stores files. */
async function sharePage(siteId, version, slug, doc) {
  const res = await fetch(`https://${PROJECT}.web.app/index.html?v=${Date.now()}`);
  if (!res.ok) return { error: { message: `main index.html: HTTP ${res.status}` } };
  const shop = toShopConfig(trial, doc, slug);
  const url = `https://${siteId}.web.app`;
  const files = await api(`${HOSTING}/${version}/files?pageSize=1000`);
  const hasLogo = (files.files ?? []).some((f) => f.path === `/logos/${slug}.png`);
  // The barber's own profile picture (uploaded in his settings) first, then his config logo.
  const image = doc.ogImage ?? shop.logoUrl ?? (hasLogo ? `${url}/logos/${slug}.png` : `${url}/pwa-512.png`);
  const html = withShareMeta(await res.text(), {
    title: shop.fullName,
    brand: shop.brand,
    description: shareDescription({ ...shop, trial: undefined }),
    image,
    url,
  });
  const gz = gzipSync(Buffer.from(html));
  return { gz, hash: createHash('sha256').update(gz).digest('hex') };
}

/** Swaps /index.html in a cloned, not yet finalized version, then finalizes it. */
async function replaceIndex(versionName, { gz, hash }) {
  const pop = await api(`${HOSTING}/${versionName}:populateFiles`, 'POST', { files: { '/index.html': hash } });
  if (pop.error) return pop;
  if (pop.uploadRequiredHashes?.includes(hash)) {
    const up = await api(`${pop.uploadUrl}/${hash}`, 'POST', gz, { 'Content-Type': 'application/octet-stream' });
    if (up.error) return up;
  }
  return api(`${HOSTING}/${versionName}?update_mask=status`, 'PATCH', { status: 'FINALIZED' });
}

/** Sign-in by SMS only works on domains listed in Firebase Auth. */
async function setAuthorizedDomain(domain, on) {
  const config = await api(AUTH_CONFIG);
  if (config.error) return config;
  const now = config.authorizedDomains ?? [];
  const next = on ? [...new Set([...now, domain])] : now.filter((d) => d !== domain);
  if (next.length === now.length) return {};
  return api(`${AUTH_CONFIG}?updateMask=authorizedDomains`, 'PATCH', { authorizedDomains: next });
}

/**
 * Creates the site if it doesn't exist yet, publishes the trial build to it (with the shop's link preview when
 * slug and doc are given) and allows sign-in there.
 * Returns null on success, or why not (taken by someone else, the 36-site limit...): the caller carries on without it.
 */
export async function ensureSite(siteId, slug, doc) {
  const existing = await api(`${HOSTING}/projects/${PROJECT}/sites/${siteId}`);
  if (existing.error?.code === 404 || existing.error?.code === 403) {
    const created = await api(`${HOSTING}/projects/${PROJECT}/sites?siteId=${siteId}`, 'POST', {});
    if (created.error) return created.error.message;
  } else if (existing.error) return existing.error.message;
  const version = await liveVersion();
  if (!version) return 'the main trial site has no live build yet';
  const released = await publish(siteId, version, slug, doc);
  if (released.error) return released.error.message;
  const domain = await setAuthorizedDomain(`${siteId}.web.app`, true);
  return domain.error ? domain.error.message : null;
}

export async function deleteSite(siteId) {
  await setAuthorizedDomain(`${siteId}.web.app`, false);
  const r = await api(`${HOSTING}/projects/${PROJECT}/sites/${siteId}`, 'DELETE');
  return r.error && r.error.code !== 404 ? r.error.message : null;
}

// ---------------------------------------------------------------- CLI

const command = process.argv[1]?.endsWith('trial-sites.mjs') ? process.argv[2] : null;
if (command) {
  const { applicationDefault, initializeApp } = await import('firebase-admin/app');
  const { FieldValue, getFirestore } = await import('firebase-admin/firestore');
  const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: PROJECT }));
  const shops = (await db.collection('trialShops').get()).docs.filter((d) => isSiteId(d.get('siteId')));

  if (command === 'sync') {
    const version = await liveVersion();
    if (!version) throw new Error('The main trial site has no live build');
    for (const d of shops) {
      const logoUrl = (await db.doc(`shops/${d.id}/meta/settings`).get()).get('logoUrl');
      const r = await publish(d.get('siteId'), version, d.id, { ...d.data(), ogImage: typeof logoUrl === 'string' ? logoUrl : undefined });
      console.log(d.get('siteId'), r.error ? `failed: ${r.error.message}` : 'updated');
    }
  } else if (command === 'cleanup') {
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    for (const d of shops) {
      const ends = d.get('trialEndsAt')?.toMillis?.();
      if (d.get('graduatedTo') || !ends || ends > cutoff) continue;
      const siteId = d.get('siteId');
      const failed = await deleteSite(siteId);
      if (failed) {
        console.log(siteId, `not deleted: ${failed}`);
        continue;
      }
      await db.doc(`trialSites/${siteId}`).delete();
      await d.ref.update({ siteId: FieldValue.delete() });
      console.log(siteId, `deleted (trial ${d.id} ended ${new Date(ends).toISOString().slice(0, 10)}); ${PROJECT}.web.app/${d.id} still works`);
    }
  } else throw new Error('usage: node scripts/trial-sites.mjs sync|cleanup');
}
