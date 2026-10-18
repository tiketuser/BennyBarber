# בני כהן ברברשופ

Booking app for Benny Cohen Barbershop, Aryeh Shenkar 65, Holon. Hebrew, RTL, mobile first, with full desktop pages.
One codebase ships as a PWA today and as iOS/Android apps through Capacitor.

```bash
npm install
npm run dev        # http://localhost:5173 (also on your phone via the LAN address)
npm run dev:demo   # the same with the demo sample data instead of the shop's Firebase
npm run deploy     # build and publish site + security rules to Firebase (npx firebase login once)
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
`backend` in the shop's config (`shops/<id>/config.ts`) picks the data: `'demo'` keeps sample data in the browser and accepts any 6-digit
code; `'firebase'` uses the shop's Firebase project (real SMS, Firestore, Storage). See `src/data/firebase/README.md`.

The layout follows the device: phones and tablets get the mobile screens, screens 1024px and wider get the desktop
pages (top navigation for customers, side menu for the admin, sheets open as a side panel).

## Barbershops

One codebase serves every shop. Each shop is a folder in `shops/<id>/` with its `config.ts` (name, address, phone,
admin numbers, Instagram, course, colors, app id, Firebase project, starting services and hours) and its icons in
`public/`. `SHOP=<id>` picks the shop for any command (`SHOP=dannylevi npm run dev`); the default is `bennycohen`.
Each build contains only its own shop. Every push deploys every ready shop to its own Firebase project.

Adding a shop: `npm run new-shop <id>`, fill `shops/<id>/config.ts`, push. The full checklist (what to ask the shop
for, the Firebase steps) is in `shops/README.md`.

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
