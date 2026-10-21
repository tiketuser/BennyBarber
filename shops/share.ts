// What a shared link shows (WhatsApp, Facebook, Telegram...): they read only the static index.html, never run the app.
// vite.config.ts fills these into each shop's build; scripts/trial-sites.mjs rewrites them for each trial barber's site.
import type { ShopConfig } from './types';

/** "קביעת תור ב<name>, <street> <city>". The trial build has no shop yet, so it gets a general line. */
export function shareDescription(shop: Pick<ShopConfig, 'fullName' | 'address' | 'trial'>): string {
  if (shop.trial) return 'קביעת תור אונליין, בכמה לחיצות';
  const where = [shop.address.street, shop.address.city].filter(Boolean).join(' ');
  return `קביעת תור ב${shop.fullName}${where ? `, ${where}` : ''}`;
}

export interface ShareMeta {
  title: string;
  brand: string;
  description: string;
  /** Absolute URL of a square image, at least 300px (the shop's logo or app icon). */
  image: string;
  url: string;
}

const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** index.html with the title, description and link-preview tags set to this shop's. */
export function withShareMeta(html: string, meta: ShareMeta): string {
  const tags: Record<string, string> = {
    description: meta.description,
    'apple-mobile-web-app-title': meta.brand,
    'og:site_name': meta.brand,
    'og:title': meta.title,
    'og:description': meta.description,
    'og:image': meta.image,
    'og:url': meta.url,
  };
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${escape(meta.title)}</title>`);
  for (const [key, value] of Object.entries(tags)) {
    out = out.replace(new RegExp(`(<meta (?:name|property)="${key}" content=")[^"]*(")`), (_, a, b) => a + escape(value) + b);
  }
  return out;
}
