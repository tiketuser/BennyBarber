/**
 * Everything that makes this app one specific salon: שמואל אורפני עיצוב שיער, כיכר ויצמן 21 חולון.
 * Details from his Instagram (@shmuel_orpani_hair), Waze and easy.co.il, 2026-10-18.
 * Services, prices and the Tuesday hours are first guesses until the salon confirms them.
 */
import { defineShop } from '../types.ts';

export default defineShop({
  /** Short name: logo, home-screen icon label, greetings. */
  brand: 'שמואל אורפני',
  /** Full name: page title, ticket, store listing. */
  fullName: 'שמואל אורפני עיצוב שיער',
  /** Word shown under the name ("ברברשופ", "מספרה", "סטודיו"). */
  kind: 'סלון בוטיק',
  /** Women's salon: the app talks to customers in the feminine and calls the place "הסלון". */
  audience: 'women',
  place: 'הסלון',
  /** One or two sentences for the website's shop page. */
  tagline: 'סלון בוטיק עם יחס אישי, מתמחה בכימיה מתקדמת: גווני בליאז׳, בלונד, אומברה והחלקות משקמות. בכיכר ויצמן בחולון.',
  address: { street: 'כיכר ויצמן 21', city: 'חולון' },
  /** Shop WhatsApp / phone number. */
  phone: '054-8068646',
  /** Numbers that open the admin view after signing in. The Firebase security rules are generated from this list. */
  adminPhones: ['054-8068646'],
  /** Instagram handle without "@", or null to hide Instagram. */
  instagram: 'shmuel_orpani_hair',
  /** Barbering course: none found for this salon. */
  course: { enabled: false, details: '' },

  /** How far ahead customers can book, in months. The admin can still add appointments further out. */
  bookingMonthsAhead: 3,

  /** Icons in public/ are his SO logo (traced from a photo), drawn by hand: don't run `npm run icons` for this shop, it would replace them with scissors.
   * Warm charcoal from his Instagram highlights, with the rosy taupe of their line art as the accent. */
  colors: { brand: '#211D1D', accent: '#E3C9BF' },

  /** Native app id (reverse domain) for the iOS / Android builds. */
  appId: 'il.co.orpani.salon',

  backend: 'firebase',
  /** Short id for this shop; its data lives under shops/{shopId} in Firestore. */
  shopId: 'orpani',
  /** Firebase web config (Project settings > Your apps > Web). These keys are public by design. */
  firebase: {
    apiKey: 'AIzaSyD1i0-EfeyMALE6AYjqyV2aZGer7OY29SQ',
    authDomain: 'barber-shmuel-orpani.firebaseapp.com',
    projectId: 'barber-shmuel-orpani',
    storageBucket: 'barber-shmuel-orpani.firebasestorage.app',
    messagingSenderId: '511387915964',
    appId: '1:511387915964:web:42169630924a6ab85922b9',
  },

  /** What a brand-new shop starts with. The admin changes all of it later in "שירותים ושעות". */
  defaults: {
    services: [
      { id: 'cut-blow', name: 'תספורת ופן', shortName: 'תספורת ופן', price: 180, durationMin: 60, priceHidden: false, order: 0 },
      { id: 'blow', name: 'פן / עיצוב', shortName: 'פן', price: 100, durationMin: 45, priceHidden: false, order: 1 },
      { id: 'roots', name: 'צבע שורשים', shortName: 'שורשים', price: 250, durationMin: 90, priceHidden: false, order: 2 },
      { id: 'balayage', name: 'גווני בליאז׳ / בלונד', shortName: 'בליאז׳', price: 900, durationMin: 180, priceHidden: true, popular: true, order: 3 },
      { id: 'ombre', name: 'אומברה', shortName: 'אומברה', price: 800, durationMin: 180, priceHidden: true, order: 4 },
      { id: 'keratin', name: 'החלקה משקמת', shortName: 'החלקה', price: 900, durationMin: 180, priceHidden: true, order: 5 },
      { id: 'men', name: 'תספורת גבר', shortName: 'גבר', price: 80, durationMin: 30, priceHidden: false, order: 6 },
    ],
    settings: {
      // 0 = Sunday ... 6 = Saturday. Minutes since midnight: 9 * 60 = 09:00. From Waze; Tuesday is not listed there.
      hours: {
        0: { open: true, from: 9 * 60, to: 19 * 60 },
        1: { open: true, from: 9 * 60, to: 19 * 60 },
        2: { open: false, from: 9 * 60, to: 19 * 60 },
        3: { open: true, from: 9 * 60, to: 19 * 60 },
        4: { open: true, from: 9 * 60, to: 19 * 60 },
        5: { open: true, from: 8 * 60, to: 14 * 60 },
        6: { open: false, from: 9 * 60, to: 14 * 60 },
      },
      breakTime: null,
      vacations: [],
    },
  },
});
