# בני כהן ברברשופ

Booking app for Benny Cohen Barbershop, Aryeh Shenkar 65, Holon. Hebrew, RTL, mobile first, with full desktop pages.
One codebase ships as a PWA today and as iOS/Android apps through Capacitor.

```bash
npm install
npm run dev        # http://localhost:5173 (also on your phone via the LAN address)
npm run build      # type-check + production build with service worker
npm run preview    # serve the build (PWA install works here)
npm run lint       # eslint
npm run format     # prettier
npm test           # unit tests for the scheduling and backend rules (vitest)
npm run test:e2e   # every feature on a phone and a desktop screen in Chromium (Playwright)
npm run test:e2e:firebase  # the same against the Firebase emulators, with the real security rules
npm run test:rules         # what a malicious customer might try, refused by the rules
```

Sign in: any `05X` number signs in as a customer, the numbers in `adminPhones` open the admin view.
`backend` in `shop.config.ts` picks the data: `'demo'` keeps sample data in the browser and accepts any 6-digit
code; `'firebase'` uses the shop's Firebase project (real SMS, Firestore, Storage). See `src/data/firebase/README.md`.

The layout follows the device: phones and tablets get the mobile screens, screens 1024px and wider get the desktop
pages (top navigation for customers, side menu for the admin, sheets open as a side panel).

## Selling to another barbershop

Everything shop-specific lives in one file, `shop.config.ts`: name, address, phone, admin numbers, Instagram,
course details, brand colors, app id, and the starting services and opening hours. Change it and rebuild; the
page title, PWA manifest, Capacitor app name, Tailwind `brand` colors and all texts pick it up. Set `instagram`
or `course` to `null` to hide those sections, and run `npm run icons` to redraw the app icons in the new colors.

## Stack

React 18 + TypeScript + Vite, Tailwind CSS, `motion` (spring animations, drag), `lucide-react`,
`vite-plugin-pwa`, Capacitor 7. Fonts (Rubik, Secular One) are bundled, so the app works offline.

## Structure

```
src/
  domain/      types + pure scheduling rules (slots, gaps, full days) shared by every backend
  data/        Backend interface, mock implementation, React hooks (useDb, useSession)
    firebase/  how Firestore + phone auth plug in (README)
  lib/         time/phone formatting, wa.me links, platform layer (haptics, share, calendar)
  ui/          bottom sheet, slide-to-confirm, steppers, tab bar, toasts
  features/
    auth/      phone + SMS code login, name once
    customer/  booking flow (desktop/ for the wide pages), waitlist, my appointments, shop, gallery, course form
    admin/     day view (desktop/ for the wide pages), quick add/block, delay notice, waitlist alert, services & hours, vacations, history
  app/         routing by role and device (phone screens or desktop pages)
```

## Native apps (Capacitor)

```bash
npm i @capacitor/ios @capacitor/android
npx cap add ios && npx cap add android
npm run cap:sync   # build + copy dist/ into the native projects
npx cap open ios   # or: npx cap open android
```

`src/lib/platform.ts` is the one place to swap web APIs for Capacitor plugins (haptics, share, app launcher).

## Icons

`npm run icons` renders the PWA / home-screen icons from the scissors mark with the bundled Chromium (Playwright).
