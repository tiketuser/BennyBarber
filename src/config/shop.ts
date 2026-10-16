import config from '../../shop.config';
import { phoneDigits } from '@/lib/phone';

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
  course: config.course,
  /** Public booking link for shared messages. Inside the native apps location.origin is not a web address. */
  appUrl: import.meta.env.VITE_APP_URL ?? location.origin,
} as const;

export const ADMIN_PHONES = config.adminPhones.map(phoneDigits);
export const DEFAULTS = config.defaults;
