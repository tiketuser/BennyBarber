import config from '../../shop.config';
import { phoneDigits } from '@/lib/phone';

export const courseFrom = (c: { enabled: boolean; details: string }) => (c.enabled ? { details: c.details } : null);

const place = `${config.address.street} ${config.address.city}`;

/** Shop facts for the screens, derived from shop.config.ts (the one file to edit per shop). */
export const SHOP = {
  brand: config.brand,
  fullName: config.fullName,
  kind: config.kind,
  tagline: config.tagline,
  address: `${config.address.street}, ${config.address.city}`,
  street: config.address.street,
  city: config.address.city,
  /** Digits only. */
  phone: phoneDigits(config.phone),
  instagram: config.instagram,
  instagramUrl: config.instagram ? `https://instagram.com/${config.instagram}` : null,
  wazeUrl: 'https://waze.com/ul?q=' + encodeURIComponent(place) + '&navigate=yes',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place),
  /** null when the course is turned off in shop.config.ts; every course screen and link checks this. */
  course: courseFrom(config.course),
  /** Public booking link for shared messages. Inside the native apps location.origin is not a web address. */
  appUrl: import.meta.env.VITE_APP_URL ?? globalThis.location?.origin ?? '',
} as const;

export const ADMIN_PHONES = config.adminPhones.map(phoneDigits);
export const DEFAULTS = config.defaults;
export const BOOKING_MONTHS = config.bookingMonthsAhead;
/** Where the data lives; VITE_BACKEND overrides it (the e2e tests and the shareable demo use 'demo'). */
export const BACKEND: 'demo' | 'firebase' = (import.meta.env.VITE_BACKEND as 'demo' | 'firebase' | undefined) ?? config.backend;
export const FIREBASE = { config: config.firebase, shopId: config.shopId };
