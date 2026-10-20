// Each trial barber's own address, <siteId>.web.app: a Firebase Hosting site inside the trial project that serves the
// same trial build as the main site. The app finds the shop from the hostname (trialSites/{siteId} -> slug).
// Free plan limits: 36 sites per project, so expired trials lose their site (cleanup); <main>/<slug> always works.
//   node scripts/trial-sites.mjs sync      publish the main site's live build to every trial site (after each deploy)
//   node scripts/trial-sites.mjs cleanup   delete the sites of trials that ended 7+ days ago and didn't graduate
// Needs GOOGLE_APPLICATION_CREDENTIALS (the deploy service account, "Firebase Admin" on the trial project).
import { GoogleAuth } from 'google-auth-library';
import trial from '../shops/trial/config.ts';

export const PROJECT = trial.firebase.projectId;
const HOSTING = 'https://firebasehosting.googleapis.com/v1beta1';
const AUTH_CONFIG = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}/config`;

/** Lowercase latin, digits and dashes, 6-30 long, no dash at either end (Firebase Hosting site ids). */
export const isSiteId = (s) => typeof s === 'string' && /^[a-z0-9][a-z0-9-]{4,28}[a-z0-9]$/.test(s);

let client;
/** The API's answer, or { error: { code, message } } instead of throwing. */
async function api(url, method = 'GET', data) {
  try {
    client ??= await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
    return (await client.request({ url, method, data })).data ?? {};
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

/** Copies the main site's live build to this site and releases it. */
async function publish(siteId, version) {
  const cloned = await waitFor(await api(`${HOSTING}/sites/${siteId}/versions:clone`, 'POST', { sourceVersion: version, finalize: true }));
  if (cloned.error) return cloned;
  return api(`${HOSTING}/sites/${siteId}/releases?versionName=${encodeURIComponent(cloned.name)}`, 'POST', {});
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
 * Creates the site if it doesn't exist yet, publishes the trial build to it and allows sign-in there.
 * Returns null on success, or why not (taken by someone else, the 36-site limit...): the caller carries on without it.
 */
export async function ensureSite(siteId) {
  const existing = await api(`${HOSTING}/projects/${PROJECT}/sites/${siteId}`);
  if (existing.error?.code === 404 || existing.error?.code === 403) {
    const created = await api(`${HOSTING}/projects/${PROJECT}/sites?siteId=${siteId}`, 'POST', {});
    if (created.error) return created.error.message;
  } else if (existing.error) return existing.error.message;
  const version = await liveVersion();
  if (!version) return 'the main trial site has no live build yet';
  const released = await publish(siteId, version);
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
      const r = await publish(d.get('siteId'), version);
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
