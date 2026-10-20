/**
 * shop.config for the trial build (SHOP=trial; vite.config.ts points every shop.config import here).
 * Reads this barber's details from Firestore trialShops/{slug} before any screen loads, then dresses the page in
 * them: title, colors, home-screen icon and install manifest. An address with no such shop shows a short notice.
 * In demo mode (no trial Firebase project yet, the tests) it uses shops/trial/sample.json for any slug.
 */
import base from '../../shops/trial/config.ts';
import sampleJson from '../../shops/trial/sample.json';
import type { ShopConfig } from '../../shops/types';
import { rgbChannels } from '../lib/color';
import { fromFields, isSlug, slugFromPath, toShopConfig, type TrialDoc } from './trialDoc';

const sample = sampleJson as TrialDoc & { slug: string };
const demo = ((import.meta.env.VITE_BACKEND as string | undefined) ?? base.backend) === 'demo';
const emulator = import.meta.env.VITE_FIREBASE_EMULATOR as string | undefined;
const docsUrl = `${emulator ? `http://${emulator}:8080` : 'https://firestore.googleapis.com'}/v1/projects/${base.firebase.projectId}/databases/(default)/documents`;

/**
 * A barber with his own site (<siteId>.web.app, scripts/trial-sites.mjs) is found by the hostname; on the main
 * trial site by the path: <main>.web.app/<slug>.
 */
const host = location.hostname;
const ownSite = !demo && host.endsWith('.web.app') && host !== `${base.firebase.projectId}.web.app` ? host.split('.')[0] : null;

/** A Firestore document's fields as plain JSON; null when it doesn't exist. Retries a flaky connection twice. */
async function read(path: string): Promise<Record<string, unknown> | null> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${docsUrl}/${path}?key=${base.firebase.apiKey}`).catch(() => null);
    if (res?.status === 404) return null;
    if (res?.ok) return fromFields((await res.json()).fields ?? {});
    if (attempt === 2) throw new Error('trial shop not reachable');
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
}

async function findSlug() {
  if (ownSite) return ((await read(`trialSites/${ownSite}`))?.slug as string | undefined) ?? '';
  return slugFromPath(location.pathname) || (demo ? sample.slug : '');
}

async function load(slug: string): Promise<TrialDoc | null> {
  if (!isSlug(slug)) return null;
  // "/ended" in demo mode: a shop whose free week is over, for trying that screen.
  if (demo) return slug === 'ended' ? { ...sample, trialEndsAt: '2020-01-01T00:00:00Z' } : sample;
  return (await read(`trialShops/${slug}`)) as TrialDoc | null;
}

/** Shown instead of the app, in plain HTML: there's no shop to dress the React app in. */
function notice(title: string, body: string): never {
  document.title = title;
  document.getElementById('root')!.innerHTML = `
    <main style="min-height:100dvh;display:grid;place-content:center;gap:8px;padding:24px;text-align:center;font-family:Rubik,system-ui,sans-serif;color:#1C1917">
      <h1 style="margin:0;font-size:22px">${title}</h1>
      <p style="margin:0;color:#57534E;font-size:15px">${body}</p>
    </main>`;
  // Stop here: nothing that imports the shop config may run without one.
  throw new Error(title);
}

const offline = () => notice('אין חיבור כרגע', 'בדקו את החיבור לאינטרנט ונסו לרענן את הדף.');
const slug = await findSlug().catch(offline);
const doc = await load(slug).catch(offline);
if (!doc) notice('הדף לא נמצא', 'כדאי לבדוק שהקישור הועתק במלואו.');

/** This shop's address: its own site, or the main trial site plus /<slug>. */
const home = ownSite ? `${location.origin}/` : `${location.origin}/${slug}/`;
const config: ShopConfig = { ...toShopConfig(base, doc, slug), appUrl: home.slice(0, -1) };
export default config;

// ---------------------------------------------------------------- the page in this shop's colors and name

const root = document.documentElement.style;
root.setProperty('--brand', rgbChannels(config.colors.brand));
root.setProperty('--brand-accent', rgbChannels(config.colors.accent));
document.title = config.fullName;
document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', config.brand);
document.querySelector('meta[name="description"]')?.setAttribute('content', `קביעת תור ל${config.fullName}`);

/** Square icon with the shop's initials ("רמי עיצוב שיער" -> "רע") in its colors, as a PNG data URL. */
function initialsIcon(size: number, padding = 0) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = config.colors.brand;
  ctx.fillRect(0, 0, size, size);
  const words = config.brand.split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '').slice(0, 2)) || '✂';
  ctx.fillStyle = config.colors.accent;
  ctx.font = `bold ${Math.round((size - padding * 2) * 0.42)}px "Secular One", Rubik, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.fillText(initials, size / 2, size / 2 + size * 0.03);
  return c.toDataURL('image/png');
}

const link = (rel: string, href: string) => {
  const el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`) ?? document.head.appendChild(Object.assign(document.createElement('link'), { rel }));
  el.href = href;
};
link('icon', initialsIcon(64));
link('apple-touch-icon', initialsIcon(180));
// Install manifest for this shop's address only, so each barber's home-screen app opens his own page.
const start = home;
const manifest = {
  name: config.fullName,
  short_name: config.brand,
  lang: 'he',
  dir: 'rtl',
  start_url: start,
  scope: start,
  id: start,
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#FFFFFF',
  theme_color: '#FFFFFF',
  icons: [
    { src: initialsIcon(192), sizes: '192x192', type: 'image/png' },
    { src: initialsIcon(512), sizes: '512x512', type: 'image/png' },
    { src: initialsIcon(512, 80), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
link('manifest', URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' })));
