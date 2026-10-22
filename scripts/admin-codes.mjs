// Fixed sign-in codes for admin numbers: Google refuses to text some Israeli numbers (error -39), so an admin number
// with a code here never gets an SMS; it signs in with its own 6-digit code instead (Firebase "phone numbers for
// testing", at most 10 per project). A shop with its own project gets codes only for its adminPhones (other numbers'
// codes are dropped there, which frees room); the shared trial project takes any number, since its admins live in
// Firestore. SHOP=<id> limits the run to that shop's project. Run by the "Admin codes" workflow.
// Firebase refuses a fixed code for a number that already has a sign-in account, so that account is removed first:
// only the sign-in record, not the shop's data (admin rights and older bookings go by the verified number), and the
// device signed in with it has to sign in again, now with the code.
// Usage: CODES='{"0548111333":"123456"}' node scripts/admin-codes.mjs   (an empty code "" removes that number's code)
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { GoogleAuth } from 'google-auth-library';
import { SHOPS } from '../shops/index.ts';

const e164 = (p) =>
  '+972' +
  String(p)
    .replace(/\D/g, '')
    .replace(/^(972|0)/, '');
const codes = Object.entries(JSON.parse(process.env.CODES ?? '{}')).map(([phone, code]) => [e164(phone), String(code)]);
for (const [phone, code] of codes) {
  if (!/^\+9725\d{8}$/.test(phone)) throw new Error(`Bad mobile number ${phone}`);
  if (code && !/^\d{6}$/.test(code)) throw new Error(`The code for ${phone} must be 6 digits`);
}

const client = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
const only = process.env.SHOP || null;
const firebaseShops = Object.entries(SHOPS).filter(([id, s]) => s.backend === 'firebase' && (!only || id === only));
if (only && !firebaseShops.length) throw new Error(`No Firebase shop called ${only}`);
const projects = [...new Set(firebaseShops.map(([, s]) => s.firebase.projectId))];
for (const project of projects) {
  // null = the trial project (any number); otherwise the admin numbers of the shops in this project.
  const inProject = Object.entries(SHOPS).filter(([, s]) => s.backend === 'firebase' && s.firebase.projectId === project);
  const admins = inProject.some(([id]) => id === 'trial') ? null : new Set(inProject.flatMap(([, s]) => s.adminPhones.map(e164)));
  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;
  try {
    const config = (await client.request({ url })).data;
    const tests = { ...config.signIn?.phoneNumber?.testPhoneNumbers };
    if (admins) for (const phone of Object.keys(tests)) if (!admins.has(phone)) delete tests[phone];
    const auth = getAuth(initializeApp({ projectId: project }, project));
    for (const [phone, code] of codes) {
      if (admins && !admins.has(phone)) continue;
      if (code && !tests[phone]) {
        const user = await auth.getUserByPhoneNumber(phone).catch(() => null);
        if (user) {
          await auth.deleteUser(user.uid);
          console.log(`${project}: removed the old SMS sign-in of ${phone.slice(0, -4)}xxxx`);
        }
      }
      if (code) tests[phone] = code;
      else delete tests[phone];
    }
    if (Object.keys(tests).length > 10) throw new Error('Firebase allows at most 10 fixed codes per project');
    const mask = 'signIn.phoneNumber.testPhoneNumbers';
    await client.request({ url: `${url}?updateMask=${mask}`, method: 'PATCH', data: { signIn: { phoneNumber: { testPhoneNumbers: tests } } } });
    console.log(`${project}: ${Object.keys(tests).length} admin numbers with a fixed code`);
  } catch (e) {
    console.log(`::error::${project}: ${e.response?.data?.error?.message ?? e.message}`);
    process.exitCode = 1;
  }
}
