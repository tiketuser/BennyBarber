import type { Service, Settings } from '../src/domain/types';

/** Everything that makes the app one specific barbershop. One file per shop: shops/<id>/config.ts. */
export interface ShopConfig {
  /** Short name: logo, home-screen icon label, greetings. */
  brand: string;
  /** Full name: page title, ticket, store listing. */
  fullName: string;
  /** Word shown under the name ("ברברשופ", "מספרה", "סטודיו"). */
  kind: string;
  /** One or two sentences for the website's shop page. */
  tagline: string;
  address: { street: string; city: string };
  /** Shop WhatsApp / phone number. */
  phone: string;
  /** Numbers that open the admin view after signing in. The Firebase security rules are generated from this list. */
  adminPhones: string[];
  /** Instagram handle without "@", or null to hide Instagram. */
  instagram: string | null;
  /** Barbering course ("קורס ספרות"): card and lead form on the shop page and the desktop menu link. enabled: false hides all of it. */
  course: { enabled: boolean; details: string };
  /** How far ahead customers can book, in months. The admin can still add appointments further out. */
  bookingMonthsAhead: number;
  /** Brand color (buttons, selected states) and the accent shown on it. `npm run icons` redraws the icons in them. */
  colors: { brand: string; accent: string };
  /** Native app id (reverse domain) for the iOS / Android builds. */
  appId: string;
  /**
   * Where the data lives. 'demo' keeps everything in the browser with sample data (any SMS code works);
   * 'firebase' uses the project below: real SMS sign-in, Firestore and Storage. See src/data/firebase/README.md.
   */
  backend: 'demo' | 'firebase';
  /** Short id for this shop; its data lives under shops/{shopId} in Firestore. Same as the folder name. */
  shopId: string;
  /** Firebase web config (Project settings > Your apps > Web). These keys are public by design. */
  firebase: { apiKey: string; authDomain: string; projectId: string; storageBucket: string; messagingSenderId: string; appId: string };
  /** What a brand-new shop starts with. The admin changes all of it later in "שירותים ושעות". */
  defaults: { services: Service[]; settings: Settings };
}

export const defineShop = (config: ShopConfig) => config;
