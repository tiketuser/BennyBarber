# בני כהן ברברשופ

Booking app for Benny Cohen Barbershop, Aryeh Shenkar 65, Holon. Hebrew, RTL, mobile first.
One codebase ships as a PWA today and as iOS/Android apps through Capacitor.

```bash
npm install
npm run dev        # http://localhost:5173 (also on your phone via the LAN address)
npm run build      # type-check + production build with service worker
npm run preview    # serve the build (PWA install works here)
```

Demo login: any `05X` number signs in as a customer, `050-0000000` opens the admin view. Any 4-digit code works.
On a desktop browser the app sits in a phone frame with a toolbar to switch customer/admin and to reset demo data.

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
    customer/  booking flow, waitlist, my appointments, shop, gallery, course form
    admin/     day view, quick add/block, delay notice, waitlist alert, services & hours, vacations, history
  app/         routing by role, desktop phone frame
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
