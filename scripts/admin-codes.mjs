// Fixed sign-in codes for admin numbers: Google refuses to text some Israeli numbers (error -39), so an admin number
// with a code here never gets an SMS; it signs in with its own 6-digit code instead (Firebase "phone numbers for
// testing", at most 10 per project). Set on every shop's Firebase project; a number is still admin only where it is
// listed in that shop's adminPhones. Run by the "Admin codes" workflow.
// Usage: CODES='{"0548111333":"123456"}' node scripts/admin-codes.mjs   (an empty code "" removes that number's code)
import { GoogleAuth } from 'google-auth-library';
import { SHOPS } from '../shops/index.ts';

const e164 = (p) => '+972' + String(p).replace(/\D/g, '').replace(/^(972|0)/, '');
const codes = Object.entries(JSON.parse(process.env.CODES ?? '{}')).map(([phone, code]) => [e164(phone), String(code)]);
for (const [phone, code] of codes) {
  if (!/^\+9725\d{8}$/.test(phone)) throw new Error(`Bad mobile number ${phone}`);
  if (code && !/^\d{6}$/.test(code)) throw new Error(`The code for ${phone} must be 6 digits`);
}

const client = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
const projects = [...new Set(Object.values(SHOPS).filter((s) => s.backend === 'firebase').map((s) => s.firebase.projectId))];
for (const project of projects) {
  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;
  try {
    const config = (await client.request({ url })).data;
    const tests = { ...config.signIn?.phoneNumber?.testPhoneNumbers };
    for (const [phone, code] of codes) {
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
