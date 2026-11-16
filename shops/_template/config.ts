/**
 * Template for a new barbershop. `npm run new-shop <id>` copies it to shops/<id>/config.ts.
 * Fill every [bracket]. The checklist of what to ask the shop for is in shops/README.md.
 */
import { defineShop } from '../types.ts';

export default defineShop({
  brand: '[שם קצר, למשל: דני לוי]',
  fullName: '[שם מלא, למשל: דני לוי ברברשופ]',
  kind: 'ברברשופ',
  // How the app talks to customers: 'men' (בחר), 'women' (בחרי) or 'all' (בחרו). And the shop as a place: 'המספרה', 'הסלון'.
  audience: 'men',
  place: 'המספרה',
  tagline: '[משפט או שניים על המספרה]',
  address: { street: '[רחוב ומספר]', city: '[עיר]' },
  phone: '050-0000000',
  adminPhones: ['054-4437070'],
  instagram: null,
  course: { enabled: false, details: '' },
  bookingMonthsAhead: 3,
  colors: { brand: '#111111', accent: '#FFD200' },
  appId: 'il.co.SHOPID.barber',
  // Stays 'demo' (not deployed) until the Firebase project exists and its config is below.
  backend: 'demo',
  shopId: 'SHOPID',
  firebase: {
    apiKey: '',
    authDomain: 'barber-SHOPID.firebaseapp.com',
    projectId: 'barber-SHOPID',
    storageBucket: 'barber-SHOPID.firebasestorage.app',
    messagingSenderId: '',
    appId: '',
  },
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
