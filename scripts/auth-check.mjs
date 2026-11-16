// Prints a shop's phone sign-in settings from its Firebase project, read-only, for when SMS stops arriving.
// Run by the "Auth check" workflow (needs GOOGLE_APPLICATION_CREDENTIALS). Usage: SHOP=<id> node scripts/auth-check.mjs
import { GoogleAuth } from 'google-auth-library';
import shop from '../shop.config.ts';

const project = shop.firebase.projectId;
const client = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
const get = async (url) => {
  try {
    return (await client.request({ url })).data;
  } catch (e) {
    return { error: e.response?.data?.error?.message ?? e.message };
  }
};

const config = await get(`https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`);
const tests = Object.keys(config.signIn?.phoneNumber?.testPhoneNumbers ?? {});
console.log(
  JSON.stringify(
    {
      project,
      error: config.error,
      phoneSignIn: config.signIn?.phoneNumber?.enabled,
      testNumbers: tests.map((n) => n.slice(0, -4) + 'xxxx'),
      smsRegionConfig: config.smsRegionConfig,
      quota: config.quota,
      authorizedDomains: config.authorizedDomains,
      identityPlatform: config.subtype ?? 'firebase auth',
    },
    null,
    2,
  ),
);
