import shop from '../shop.config.ts';
// Tries what a malicious customer could do straight against the Firebase emulators and expects the rules to refuse.
// Usage: npm run test:rules
const PROJECT = 'barber-bennycohen';
const SHOP = 'bennycohen';
const AUTH = `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1`;
const DOCS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const ROOT = `projects/${PROJECT}/databases/(default)/documents/shops/${SHOP}`;

async function signIn(phone) {
  const post = (path, body) =>
    fetch(`${AUTH}/${path}?key=fake`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
  const { sessionInfo } = await post('accounts:sendVerificationCode', { phoneNumber: phone });
  const codes = await (await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/verificationCodes`)).json();
  const code = codes.verificationCodes.filter((c) => c.phoneNumber === phone).at(-1).code;
  return (await post('accounts:signInWithPhoneNumber', { sessionInfo, code })).idToken;
}

const enc = (v) =>
  typeof v === 'number'
    ? { integerValue: String(v) }
    : typeof v === 'string'
      ? { stringValue: v }
      : Array.isArray(v)
        ? { arrayValue: { values: v.map(enc) } }
        : { mapValue: { fields: fields(v) } };
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));
const req = (token, method, path, body) =>
  fetch(`${DOCS}/${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
const put = (path, data) => ({ update: { name: `${ROOT}/${path}`, fields: fields(data) } });

const results = [];
async function expectDenied(name, res) {
  const ok = (await res).status === 403;
  results.push(ok);
  console.log(ok ? '  ✓' : '  ✗', name);
}
async function expectAllowed(name, res) {
  const r = await res;
  const ok = r.ok;
  results.push(ok);
  console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : r.status + ' ' + (await r.text()).slice(0, 200));
}

// documents:commit writes several documents atomically, like a transaction.
const commitUrl = (token, writes) =>
  fetch(`${DOCS}:commit`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ writes }) });

const me = await signIn('+972521112233');
const admin = await signIn('+972' + shop.adminPhones[0].replace(/\D/g, '').slice(1));
const appt = {
  date: '2099-01-04',
  start: 600,
  end: 630,
  serviceId: 'cut',
  serviceName: 'x',
  price: 70,
  customerName: 'x',
  phone: '0521112233',
  status: 'booked',
  source: 'app',
  createdAt: 1,
};

console.log('\nSecurity rules');
await expectDenied('signed out: cannot list appointments', req(null, 'GET', `shops/${SHOP}/appointments`));
await expectDenied("customer: cannot list everyone's appointments", req(me, 'GET', `shops/${SHOP}/appointments`));
await expectDenied('customer: cannot change prices', req(me, 'PATCH', `shops/${SHOP}/services/cut`, { fields: fields({ price: 1 }) }));
await expectDenied('customer: cannot change opening hours', req(me, 'PATCH', `shops/${SHOP}/meta/settings`, { fields: fields({ x: 1 }) }));
await expectDenied('customer: cannot read blocks', req(me, 'GET', `shops/${SHOP}/blocks`));
await expectDenied(
  "customer: cannot book in someone else's name",
  commitUrl(me, [put('appointments/a1', { ...appt, customerPhone: '0529999999' }), put('days/2099-01-04', { busy: [{ id: 'a1', start: 600, end: 630 }] })]),
);
await expectDenied('customer: cannot book without the day ledger', commitUrl(me, [put('appointments/a2', { ...appt, customerPhone: '0521112233' })]));
await expectAllowed(
  'customer: can book own appointment with the ledger',
  commitUrl(me, [put('appointments/a3', { ...appt, customerPhone: '0521112233' }), put('days/2099-01-04', { busy: [{ id: 'a3', start: 600, end: 630 }] })]),
);
await expectAllowed(
  'admin: can add a walk-in to the same day',
  commitUrl(admin, [
    put('appointments/w1', { ...appt, start: 700, end: 730, source: 'walkin' }),
    put('days/2099-01-04', {
      busy: [
        { id: 'a3', start: 600, end: 630 },
        { id: 'w1', start: 700, end: 730 },
      ],
    }),
  ]),
);
await expectDenied("customer: cannot wipe a day's busy times", commitUrl(me, [put('days/2099-01-04', { busy: [] })]));
await expectDenied(
  "customer: cannot cancel someone else's appointment",
  commitUrl(me, [
    put('appointments/w1', { ...appt, start: 700, end: 730, source: 'walkin', status: 'cancelled', cancelledBy: 'customer' }),
    put('days/2099-01-04', { busy: [{ id: 'a3', start: 600, end: 630 }] }),
  ]),
);
await expectDenied(
  'customer: cannot join the waitlist as someone else',
  req(me, 'PATCH', `shops/${SHOP}/waitlist/x1`, { fields: fields({ date: '2099-01-04', customerPhone: '0529999999' }) }),
);
await expectDenied(
  'customer: cannot upload to the gallery',
  fetch(`http://127.0.0.1:9199/v0/b/${PROJECT}.firebasestorage.app/o?name=shops%2F${SHOP}%2Fgallery%2Fx.jpg`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg', Authorization: `Firebase ${me}` },
    body: 'x',
  }),
);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
