# Plugging in Firebase

The UI only talks to the `Backend` interface in `src/data/backend.ts`. Today `createBackend()` returns the
mock (in-memory + localStorage). To go live, add `createFirebaseBackend()` here and switch in `src/data/index.ts`.
No screen changes.

## Collections (Firestore)

| Collection | Doc shape | Notes |
| --- | --- | --- |
| `services/{id}` | `Service` | Public read, admin write. |
| `settings/shop` | `Settings` | One doc: weekly hours, fixed break, vacations. Public read, admin write. |
| `appointments/{id}` | `Appointment` | Customer creates own (`customerPhone == auth phone`), reads own; admin reads/writes all. |
| `blocks/{id}` | `Block` | Admin only; customers need only busy ranges (see below). |
| `waitlist/{id}` | `WaitlistEntry` | Customer creates/deletes own; admin reads all. |
| `gallery/{id}` | `GalleryItem` | `src` points to Firebase Storage. Admin write. |
| `admins/{phone}` | `{}` | Admin phone numbers. Drives the `admin` custom claim. |

`getSnapshot()` stays the same: keep one `DbSnapshot` object in memory and replace it on every
`onSnapshot` callback, then notify subscribers. Customers should not download everyone's appointments:
publish a `busy/{date}` doc (ranges only, no names) from a Cloud Function and build the customer
snapshot from that.

## Auth

- `sendCode` / `verifyCode` → `signInWithPhoneNumber` with an invisible reCAPTCHA on the web,
  `@capacitor-firebase/authentication` in the native apps (no reCAPTCHA, SMS auto-fill on Android).
- `role` comes from the `admin` custom claim (set by a function when the phone is in `admins/`), never from the client.
- `saveName` writes `users/{uid}.name`.

## Booking safety

`book()` must run in a transaction (or a callable function) that re-checks `assertBookable`
from `src/domain/schedule.ts`, so two people can't grab the same slot.

## WhatsApp

Screens open `wa.me` links one chat at a time (`useSendQueue`). With the WhatsApp Business Cloud API,
a callable function can send the delay notice, waitlist alert, vacation notice and reminders in one call;
the UI keeps the same per-person "sent" state.
