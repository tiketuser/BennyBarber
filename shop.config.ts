/**
 * Everything that makes this app one specific barbershop. To set it up for another shop,
 * change this file (and the icons in public/, see `npm run icons`). Nothing else needs editing.
 *
 * Values in [brackets] are placeholders to fill before launch.
 */
import type { Service, Settings } from './src/domain/types';

const shop = {
  /** Short name: logo, home-screen icon label, greetings. */
  brand: 'בני כהן',
  /** Full name: page title, ticket, store listing. */
  fullName: 'בני כהן ברברשופ',
  /** Word shown under the name ("ברברשופ", "מספרה", "סטודיו"). */
  kind: 'ברברשופ',
  /** One or two sentences for the website's shop page. */
  tagline: 'תספורות גברים, זקן וילדים בלב חולון. קובעים תור אונליין בדקה, מגיעים ויושבים.',
  address: { street: 'אריה שנקר 65', city: 'חולון' },
  /** Shop WhatsApp / phone number. */
  phone: '050-0000000',
  /** Numbers that open the admin view after signing in. The Firebase security rules are generated from this list. */
  adminPhones: ['054-4437070'],
  /** Instagram handle without "@", or null to hide Instagram. */
  instagram: '[שם באינסטגרם]' as string | null,
  /** Barbering course lead form. Set to null to hide the course everywhere. */
  course: { details: '[משך הקורס] • [מחיר] • [מועד הפתיחה הבא]' } as { details: string } | null,

  /** Brand color (buttons, selected states) and the accent shown on it. */
  colors: { brand: '#111111', accent: '#FFD200' },

  /** Native app id (reverse domain) for the iOS / Android builds. */
  appId: 'il.co.bennycohen.barber',

  /**
   * Where the data lives. 'demo' keeps everything in the browser with sample data (any SMS code works);
   * 'firebase' uses the project below: real SMS sign-in, Firestore and Storage. See src/data/firebase/README.md.
   */
  backend: 'firebase' as 'demo' | 'firebase',
  /** Short id for this shop; its data lives under shops/{shopId} in Firestore. */
  shopId: 'bennycohen',
  /** Firebase web config (Project settings > Your apps > Web). These keys are public by design. */
  firebase: {
    apiKey: 'AIzaSyA5bUBlZocFaYu7nnMAzZczxMsvD-mZn4w',
    authDomain: 'barber-bennycohen.firebaseapp.com',
    projectId: 'barber-bennycohen',
    storageBucket: 'barber-bennycohen.firebasestorage.app',
    messagingSenderId: '718286180591',
    appId: '1:718286180591:web:5d5418835fcb51e686cb1a',
  },

  /** What a brand-new shop starts with. The admin changes all of it later in "שירותים ושעות". */
  defaults: {
    services: [
      { id: 'cut', name: 'תספורת גבר', shortName: 'תספורת', price: 70, durationMin: 30, priceHidden: false, order: 0 },
      { id: 'cut-beard', name: 'תספורת + זקן', shortName: 'תספורת + זקן', price: 100, durationMin: 45, priceHidden: false, popular: true, order: 1 },
      { id: 'soldier', name: 'חייל / סטודנט HIT', shortName: 'חייל', price: 60, durationMin: 30, priceHidden: false, order: 2 },
      { id: 'beard', name: 'עיצוב וגילוח זקן', shortName: 'זקן', price: 50, durationMin: 20, priceHidden: false, order: 3 },
      { id: 'kid', name: 'תספורת ילד', shortName: 'ילד', price: 60, durationMin: 30, priceHidden: true, order: 4 },
    ] satisfies Service[],
    settings: {
      // 0 = Sunday ... 6 = Saturday. Minutes since midnight: 9 * 60 = 09:00.
      hours: {
        0: { open: true, from: 9 * 60, to: 20 * 60 },
        1: { open: true, from: 9 * 60, to: 20 * 60 },
        2: { open: true, from: 9 * 60, to: 20 * 60 },
        3: { open: true, from: 9 * 60, to: 20 * 60 },
        4: { open: true, from: 9 * 60, to: 20 * 60 },
        5: { open: true, from: 8 * 60 + 30, to: 14 * 60 + 30 },
        6: { open: false, from: 9 * 60, to: 14 * 60 },
      },
      breakTime: { from: 13 * 60, to: 13 * 60 + 30 },
      vacations: [],
    } satisfies Settings,
  },
};

export default shop;
