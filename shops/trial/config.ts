/**
 * The shared trial site: one build for every barber on a free trial week, at https://barber-trial-310e8.web.app/<slug>,
 * or his own https://barber-<name>.web.app (scripts/trial-sites.mjs).
 * The shop's own details are not here: the app reads them at runtime from Firestore trialShops/{slug}, which the
 * outreach automation writes (src/trial/trialShop.ts, shape in /mnt/project-files/outreach/trial-spec.md).
 * What's below is the fallback for anything that document leaves out, plus the trial project's Firebase config.
 * A barber who pays moves to his own shop folder: npm run graduate <slug> <id>.
 */
import { defineShop } from '../types.ts';

export default defineShop({
  brand: 'המספרה',
  fullName: 'קביעת תורים',
  kind: 'ברברשופ',
  // How the app talks to customers: 'men' (בחר), 'women' (בחרי) or 'all' (בחרו). And the shop as a place: 'המספרה', 'הסלון'.
  audience: 'men',
  place: 'המספרה',
  tagline: '',
  address: { street: '', city: '' },
  phone: '050-0000000',
  // Each trial shop's admins come from its document (adminPhones); the security rules read adminPhonesE164 there.
  adminPhones: [],
  instagram: null,
  course: { enabled: false, details: '' },
  bookingMonthsAhead: 3,
  colors: { brand: '#111111', accent: '#FFD200' },
  appId: 'il.co.trial.barber',
  backend: 'firebase',
  shopId: 'trial',
  firebase: {
    apiKey: 'AIzaSyAiY8fHyfvMRjWGKOOUTghs7tk4dGc6adw',
    authDomain: 'barber-trial-310e8.firebaseapp.com',
    projectId: 'barber-trial-310e8',
    storageBucket: 'barber-trial-310e8.firebasestorage.app',
    messagingSenderId: '305985684663',
    appId: '1:305985684663:web:b309c4f4fbfef102043932',
  },
  // Who the barber talks to when the free week ends ("תקופת הניסיון הסתיימה").
  trial: { contactName: 'אביב', contactPhone: '054-4437070' },
  defaults: {
    services: [
      { id: 'cut', name: 'תספורת גבר', shortName: 'תספורת', price: 70, durationMin: 30, priceHidden: false, order: 0 },
      { id: 'cut-beard', name: 'תספורת + זקן', shortName: 'תספורת + זקן', price: 100, durationMin: 45, priceHidden: false, popular: true, order: 1 },
      { id: 'beard', name: 'עיצוב וגילוח זקן', shortName: 'זקן', price: 50, durationMin: 20, priceHidden: false, order: 2 },
      { id: 'kid', name: 'תספורת ילד', shortName: 'ילד', price: 60, durationMin: 30, priceHidden: false, order: 3 },
    ],
    settings: {
      // 0 = Sunday ... 6 = Saturday. Minutes since midnight: 9 * 60 = 09:00.
      hours: {
        0: { open: true, from: 9 * 60, to: 20 * 60 },
        1: { open: true, from: 9 * 60, to: 20 * 60 },
        2: { open: true, from: 9 * 60, to: 20 * 60 },
        3: { open: true, from: 9 * 60, to: 20 * 60 },
        4: { open: true, from: 9 * 60, to: 20 * 60 },
        5: { open: true, from: 9 * 60, to: 14 * 60 },
        6: { open: false, from: 9 * 60, to: 14 * 60 },
      },
      breakTime: null,
      vacations: [],
    },
  },
});
