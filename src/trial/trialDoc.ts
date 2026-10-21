// The trial shop document (Firestore trialShops/{slug}, written by the outreach automation) and how it becomes a ShopConfig.
// Pure functions, so the tests and the graduate script use them too.
import type { ShopConfig } from '../../shops/types';

/** What the automation writes. Everything but brand and phone may be missing; the trial config fills the rest. */
export interface TrialDoc {
  slug?: string;
  brand: string;
  fullName?: string;
  kind?: string;
  place?: string;
  audience?: ShopConfig['audience'];
  tagline?: string;
  address?: Partial<ShopConfig['address']>;
  phone: string;
  adminPhones?: string[];
  adminPhonesE164?: string[];
  instagram?: string | null;
  colors?: Partial<ShopConfig['colors']>;
  course?: ShopConfig['course'];
  bookingMonthsAhead?: number;
  defaults?: { services?: ShopConfig['defaults']['services']; settings?: Partial<ShopConfig['defaults']['settings']> };
  galleryUrls?: string[];
  logoUrl?: string;
  createdAt?: string;
  trialEndsAt?: string;
}

/** Lowercase latin letters, digits and dashes: the part of the address after the site name. */
export const isSlug = (s: string) => /^[a-z0-9][a-z0-9-]{1,59}$/.test(s);

/** "/rami-hair-jerusalem/..." -> "rami-hair-jerusalem". */
export const slugFromPath = (path: string) => decodeURIComponent(path.split('/')[1] ?? '').toLowerCase();

type Value = Record<string, unknown>;
/** A Firestore REST value ({ stringValue: "x" }, { mapValue: { fields } } ...) as plain JSON. Timestamps become ISO strings. */
export function fromValue(v: Value): unknown {
  if ('mapValue' in v) return fromFields(((v.mapValue as Value).fields ?? {}) as Record<string, Value>);
  if ('arrayValue' in v) return (((v.arrayValue as Value).values ?? []) as Value[]).map(fromValue);
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return new Date(v.timestampValue as string).toISOString();
  return undefined;
}
export const fromFields = (fields: Record<string, Value>) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromValue(v)]));

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** The trial build's config (shops/trial/config.ts) with this barber's details on top. Data lives under shops/{slug}. */
export function toShopConfig(base: ShopConfig, doc: TrialDoc, slug: string): ShopConfig {
  const settings = { ...base.defaults.settings, ...doc.defaults?.settings };
  return {
    ...base,
    brand: str(doc.brand) ?? base.brand,
    fullName: str(doc.fullName) ?? str(doc.brand) ?? base.fullName,
    kind: str(doc.kind) ?? base.kind,
    place: str(doc.place) ?? base.place,
    audience: doc.audience ?? base.audience,
    tagline: str(doc.tagline) ?? base.tagline,
    address: { street: str(doc.address?.street) ?? '', city: str(doc.address?.city) ?? '' },
    phone: str(doc.phone) ?? base.phone,
    adminPhones: doc.adminPhones ?? [],
    instagram: str(doc.instagram) ?? null,
    course: doc.course ?? base.course,
    bookingMonthsAhead: doc.bookingMonthsAhead ?? base.bookingMonthsAhead,
    colors: { brand: str(doc.colors?.brand) ?? base.colors.brand, accent: str(doc.colors?.accent) ?? base.colors.accent },
    shopId: slug,
    defaults: { services: doc.defaults?.services?.length ? doc.defaults.services : base.defaults.services, settings },
    galleryUrls: doc.galleryUrls ?? [],
    logoUrl: str(doc.logoUrl),
    trialEndsAt: str(doc.trialEndsAt),
  };
}
