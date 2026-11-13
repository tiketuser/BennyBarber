import config from '../../shop.config';
import { phoneDigits } from '@/lib/phone';
import type { GalleryItem } from '@/domain/types';

export const courseFrom = (c: { enabled: boolean; details: string }) => (c.enabled ? { details: c.details } : null);

const where = `${config.address.street} ${config.address.city}`;
/** The barber's own WhatsApp: the shop number, or (while it is still the template's 050-0000000) his admin number, listed last. */
const barberPhone = phoneDigits(config.phone) !== '0500000000' ? config.phone : (config.adminPhones.at(-1) ?? config.phone);

/** "המספרה" / "הסלון" with its "ב" and "ל" forms ("במספרה", "לסלון") and "סגורה" / "סגור" by the noun's gender. */
export const placeForms = (place = 'המספרה') => {
  const bare = place.replace(/^ה/, '');
  return { place, inPlace: 'ב' + bare, toPlace: 'ל' + bare, closed: `${place} ${place.endsWith('ה') ? 'סגורה' : 'סגור'}` };
};

export const AUDIENCE = config.audience ?? 'men';
/**
 * Customer copy in the shop's audience: g('בחר', 'בחרי', 'בחרו'). Only for what the app says to customers;
 * the admin screens talk to the owner.
 */
export const g = (men: string, women: string, all: string) => (AUDIENCE === 'women' ? women : AUDIENCE === 'all' ? all : men);

/** Shop facts for the screens, derived from the shop config(shops/<id>/config.ts). */
export const SHOP = {
  brand: config.brand,
  fullName: config.fullName,
  kind: config.kind,
  ...placeForms(config.place),
  /** The shop's own mark (shops/<id>/public/logo-mark.svg) instead of the scissors; see ShopMark. */
  logoMark: __SHOP_LOGO_MARK__,
  /** A round logo picture that fills the badge instead (trial shops); see ShopMark. */
  logoUrl: config.logoUrl,
  tagline: config.tagline,
  address: `${config.address.street}, ${config.address.city}`,
  street: config.address.street,
  city: config.address.city,
  /** Digits only. */
  phone: phoneDigits(barberPhone),
  instagram: config.instagram,
  instagramUrl: config.instagram ? `https://instagram.com/${config.instagram}` : null,
  wazeUrl: 'https://waze.com/ul?q=' + encodeURIComponent(where) + '&navigate=yes',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(where),
  /** null when the course is turned off in the shop config (shops/<id>/config.ts); every course screen and link checks this. */
  course: courseFrom(config.course),
  /** Public booking link for shared messages. Inside the native apps location.origin is not a web address. */
  appUrl: config.appUrl ?? import.meta.env.VITE_APP_URL ?? globalThis.location?.origin ?? '',
} as const;

export const ADMIN_PHONES = config.adminPhones.map(phoneDigits);
export const DEFAULTS = config.defaults;
export const BOOKING_MONTHS = config.bookingMonthsAhead;
/** Where the data lives; VITE_BACKEND overrides it (the e2e tests and the shareable demo use 'demo'). */
export const BACKEND: 'demo' | 'firebase' = (import.meta.env.VITE_BACKEND as 'demo' | 'firebase' | undefined) ?? config.backend;
export const FIREBASE = { config: config.firebase, shopId: config.shopId };

/** Trial shops (shops/trial): when the free week ends and who to talk to about keeping the app. null for every real shop. */
export const TRIAL = config.trial
  ? { endsAt: config.trialEndsAt ? new Date(config.trialEndsAt) : null, contactName: config.trial.contactName, contactPhone: phoneDigits(config.trial.contactPhone) }
  : null;
export const trialEnded = (now = new Date()) => !!TRIAL?.endsAt && now >= TRIAL.endsAt;

/** Starting photos (trial shops: from Google Maps). The admin's first sign-in copies them into the real gallery. */
export const STARTER_GALLERY: GalleryItem[] = (config.galleryUrls ?? []).map((src, i) => ({
  id: `starter-${i}`,
  src,
  category: 'haircut',
  pinned: i < 4,
  order: i,
}));
