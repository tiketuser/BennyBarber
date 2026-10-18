# Barbershops

One folder per shop: `config.ts` (everything that makes the app that shop) and `public/` (its icons).
`shops/index.ts` lists them; `SHOP=<id>` picks one for any command; each build contains only its own shop.

## Adding a shop

1. `npm run new-shop <id>` (lowercase latin, e.g. `dannylevi`). Copies `_template`, registers it, draws icons.
2. Fill `shops/<id>/config.ts` with what the shop sent (list below). Redraw icons after changing colors:
   `SHOP=<id> npm run icons`.
3. Create the shop's Firebase project (steps below) and paste its web config into `firebase`, then set
   `backend: 'firebase'`.
4. Push. The deploy workflow publishes it to `https://barber-<id>.web.app` together with every other shop.

## What to get from the shop

- Name as shown in the logo, full business name, and the word under it (ברברשופ / מספרה / סטודיו)
- One or two sentences about the shop
- Street and number, city
- Phone / WhatsApp number of the shop
- Mobile numbers that should open the admin view (the owner, and any barber who manages the calendar)
- Instagram handle, if any
- Barbering course: yes or no, and if yes, length, price and next start date
- Services: name, price, duration in minutes, and whether the price is shown to customers
- Opening hours per day, break time, and days off coming up
- How far ahead customers may book (default 3 months)
- Brand colors (two: main and accent), or a logo to take them from
- Gallery photos (the owner can also upload them from the admin view later)

## Firebase project (done by the owner of the business Google account)

1. Create the project `barber-<id>` in console.firebase.google.com and upgrade it to Blaze (set a budget alert).
2. Authentication > Sign-in method > Phone: enable. Settings > SMS region policy: allow Israel.
3. Firestore: create in `me-west1`, production mode. Storage: create in `US-CENTRAL1`.
4. Hosting: Get started (only to activate it; the deploy does the rest).
5. Project settings > Your apps > Web: register an app and copy its config into `config.ts`.
6. Google Cloud console > IAM for this project > Grant access: the existing service account
   `github-deploy@barber-bennycohen.iam.gserviceaccount.com`, roles "Firebase Admin" and "Service Usage Consumer".
   That lets the existing GitHub deploy key publish this shop too; no new secret needed.
