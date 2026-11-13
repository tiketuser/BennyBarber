// Prints the shop's profile picture (settings.logoUrl, uploaded in the admin's settings), or nothing.
// The deploy puts it in the link preview (og:image), since WhatsApp reads only the static index.html.
// Usage: SHOP=<id> node --experimental-strip-types scripts/og-image.mjs   (needs GOOGLE_APPLICATION_CREDENTIALS)
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SHOPS } from '../shops/index.ts';

const shop = SHOPS[process.env.SHOP];
if (!shop) throw new Error(`unknown shop ${process.env.SHOP}`);
const fs = getFirestore(initializeApp({ credential: applicationDefault(), projectId: shop.firebase.projectId }));
const logoUrl = (await fs.doc(`shops/${shop.shopId}/meta/settings`).get()).get('logoUrl');
if (typeof logoUrl === 'string' && logoUrl.startsWith('https://')) console.log(logoUrl);
