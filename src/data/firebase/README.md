# Firebase

`firebaseBackend.ts` implements the same `Backend` contract as the demo (`../mock`), so no screen knows which one runs.
The shop's config (`shops/<id>/config.ts`) picks it: `backend: 'firebase'` (or `VITE_BACKEND=firebase` for one build). The Firebase code is
loaded only in that case, so demo builds don't carry it.

## Going live for a shop

1. In the Firebase console of the shop's project: Blaze plan, Authentication > Phone (SMS region policy: Israel),
   Firestore (me-west1, production mode), Storage (US-CENTRAL1 keeps photos in the free tier), and
   Hosting > Get started (free site at `<project>.web.app`, already authorized for SMS sign-in).
2. Put the web config, the real admin numbers (`adminPhones`) and `backend: 'firebase'` in `shops/<id>/config.ts`.
3. Push. `.github/workflows/deploy.yml` runs `npm run deploy` for every ready shop: it builds the site, regenerates
   `firestore.rules` / `storage.rules` from the shop's config, and uploads site and rules together. By hand:
   `npx firebase login` once, then `SHOP=<id> npm run deploy`.
4. The first admin sign-in writes the starting services and hours from the shop's config.

## Data (all under `shops/{shopId}`)

| Path                | What                                  | Who                                                       |
| ------------------- | ------------------------------------- | --------------------------------------------------------- |
| `meta/settings`     | `Settings`: hours, break, vacations   | Everyone reads, admin writes                              |
| `services/{id}`     | `Service`                             | Everyone reads, admin writes                              |
| `gallery/{id}`      | `GalleryItem`, `src` is a Storage URL | Everyone reads, admin writes                              |
| `appointments/{id}` | `Appointment`                         | Customer: own (`customerPhone`); admin: all               |
| `days/{date}`       | `{ busy: [{ id, start, end }] }`      | Everyone reads (no names). Kept in step with appointments |
| `blocks/{id}`       | `Block`                               | Admin only (also listed in `days`)                        |
| `waitlist/{id}`     | `WaitlistEntry`                       | Customer: own; admin: all                                 |
| `users/{uid}`       | `{ name, phone }`                     | The user; admin reads                                     |

Storage: `shops/{shopId}/gallery/{id}.jpg`, public read, admin write, images under 3 MB.

## How booking stays safe

`days/{date}` is the day's ledger of busy ranges. Booking, cancelling, walk-ins and blocks run in a transaction
that reads the ledger, re-checks `assertBookable` and writes the appointment and the ledger together, so two
people can't take the same slot. The rules only let a customer add their own new appointment to a ledger or take
their own cancelled one off it, and an appointment can't be created unless it is in the ledger.

Admin = a phone number listed in `adminPhones`; the rules check the signed-in phone number, never the client.

## Tests

- `npm run test:e2e:firebase` runs every e2e step against the emulators with the real rules (the auth emulator
  hands out the SMS codes, `e2e/seed-firebase.ts` loads the demo sample data).
- `npm run test:rules` tries what a malicious customer could do and expects the rules to refuse.

## Native apps

Phone sign-in on the web uses an invisible reCAPTCHA. Inside the Capacitor apps switch `sendCode`/`verifyCode`
to `@capacitor-firebase/authentication` (no reCAPTCHA; Android needs the app's SHA-1 in the console).

## WhatsApp

Screens open `wa.me` links one chat at a time (`useSendQueue`). With the WhatsApp Business Cloud API, a function
could send the delay notice, waitlist alert and vacation notice in one call; the UI keeps the same per-person state.
