// Turns on anonymous sign-in for the shop's Firebase project (SHOP env): customers sign in with their number and name
// only, as an anonymous user that owns its bookings; admin numbers still sign in by SMS. Run by the deploy for every shop.
// Needs GOOGLE_APPLICATION_CREDENTIALS (the deploy service account, "Firebase Admin" on the project).
import { GoogleAuth } from 'google-auth-library';
import { SHOPS } from '../shops/index.ts';

const shop = SHOPS[process.env.SHOP || 'bennycohen'];
const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${shop.firebase.projectId}/config`;
const client = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
const config = (await client.request({ url })).data;
if (config.signIn?.anonymous?.enabled) console.log(`${shop.firebase.projectId}: anonymous sign-in already on`);
else {
  await client.request({ url: `${url}?updateMask=signIn.anonymous.enabled`, method: 'PATCH', data: { signIn: { anonymous: { enabled: true } } } });
  console.log(`${shop.firebase.projectId}: anonymous sign-in turned on`);
}
