import shop from '../shop.config.ts';
import sample from '../shops/trial/sample.json' with { type: 'json' };
// Tries what a malicious customer could do straight against the Firebase emulators and expects the rules to refuse.
// Usage: npm run test:rules   (SHOP=trial npm run test:rules for the shared trial project)
const trial = !!shop.trial;
const PROJECT = shop.firebase.projectId;
const SHOP = trial ? sample.slug : shop.shopId;
const AUTH = `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1`;
const DOCS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const ROOT = `projects/${PROJECT}/databases/(default)/documents/shops/${SHOP}`;

const post = (path, body) =>
  fetch(`${AUTH}/${path}?key=fake`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
/** Sign-in id of each token, for the customerUid field. */
const uidOf = new Map();
async function signIn(phone) {
  const { sessionInfo } = await post('accounts:sendVerificationCode', { phoneNumber: phone });
  const codes = await (await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/verificationCodes`)).json();
  const code = codes.verificationCodes.filter((c) => c.phoneNumber === phone).at(-1).code;
  const r = await post('accounts:signInWithPhoneNumber', { sessionInfo, code });
  uidOf.set(r.idToken, r.localId);
  return r.idToken;
}
/** A customer as the app signs one in: no SMS code, just an anonymous sign-in. */
async function signInAnon() {
  const r = await post('accounts:signUp', { returnSecureToken: true });
  uidOf.set(r.idToken, r.localId);
  return r.idToken;
}
/** documents:runQuery for one field equal to a value, like the app's "my appointments". */
const queryBy = (token, collection, field, value) =>
  fetch(`${DOCS}/shops/${SHOP}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: enc(value) } } } }),
  });

const enc = (v) =>
  v === null
    ? { nullValue: null }
    : typeof v === 'boolean'
      ? { booleanValue: v }
      : typeof v === 'number'
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

// Uploads like the app's SDK does (multipart, so the file's image type is part of the request).
const upload = (token, path, type = 'image/jpeg') => {
  const body = `--b\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ name: path, contentType: type })}\r\n--b\r\nContent-Type: ${type}\r\n\r\nx\r\n--b--`;
  return fetch(`http://127.0.0.1:9199/v0/b/${PROJECT}.firebasestorage.app/o?name=${encodeURIComponent(path)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/related; boundary=b', 'X-Goog-Upload-Protocol': 'multipart', Authorization: `Firebase ${token}` },
    body,
  });
};

// Booking days a few days from now: the rules only take bookings inside the shop's booking window.
const dayFromNow = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const [D4, D5, D6] = [4, 5, 6].map(dayFromNow);

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

// The emulator lets "owner" write past the rules, like the automation's service account.
const asOwner = (path, data) =>
  fetch(`${DOCS}/${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify({ fields: fields(data) }) });
const ts = (iso) => ({ timestampValue: iso });
if (trial) {
  const doc = { ...sample };
  delete doc.createdAt;
  delete doc.trialEndsAt;
  await asOwner(`trialShops/${SHOP}`, doc);
  await fetch(`${DOCS}/trialShops/${SHOP}?updateMask.fieldPaths=trialEndsAt`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: { trialEndsAt: ts('2099-01-01T00:00:00Z') } }),
  });
  await asOwner('trialShops/other-shop', { ...doc, slug: 'other-shop', adminPhones: ['0529990000'], adminPhonesE164: ['+972529990000'] });
}

const me = await signIn('+972521112233');
const adminPhones = trial ? sample.adminPhones : shop.adminPhones;
const admin = await signIn('+972' + adminPhones[0].replace(/\D/g, '').slice(1));
const appt = {
  date: D4,
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
  commitUrl(me, [put('appointments/a1', { ...appt, customerPhone: '0529999999' }), put('days/' + D4, { busy: [{ id: 'a1', start: 600, end: 630 }] })]),
);
await expectDenied('customer: cannot book without the day ledger', commitUrl(me, [put('appointments/a2', { ...appt, customerPhone: '0521112233' })]));
await expectAllowed(
  'customer: can book own appointment with the ledger',
  commitUrl(me, [put('appointments/a3', { ...appt, customerPhone: '0521112233', customerUid: uidOf.get(me) }), put('days/' + D4, { busy: [{ id: 'a3', start: 600, end: 630 }] })]),
);
await expectAllowed(
  'admin: can add a walk-in to the same day',
  commitUrl(admin, [
    put('appointments/w1', { ...appt, start: 700, end: 730, source: 'walkin' }),
    put('days/' + D4, {
      busy: [
        { id: 'a3', start: 600, end: 630 },
        { id: 'w1', start: 700, end: 730 },
      ],
    }),
  ]),
);
await expectDenied("customer: cannot wipe a day's busy times", commitUrl(me, [put('days/' + D4, { busy: [] })]));
await expectDenied(
  "customer: cannot cancel someone else's appointment",
  commitUrl(me, [
    put('appointments/w1', { ...appt, start: 700, end: 730, source: 'walkin', status: 'cancelled', cancelledBy: 'customer' }),
    put('days/' + D4, { busy: [{ id: 'a3', start: 600, end: 630 }] }),
  ]),
);
await expectDenied(
  'customer: cannot join the waitlist as someone else',
  req(me, 'PATCH', `shops/${SHOP}/waitlist/x1`, { fields: fields({ date: D4, customerPhone: '0529999999' }) }),
);
await expectDenied('customer: cannot upload to the gallery', upload(me, `shops/${SHOP}/gallery/x.jpg`));

console.log('\nCustomers without an SMS code');
const anon = await signInAnon();
const anonId = uidOf.get(anon);
await expectAllowed('customer: can save a calendar file under own id', upload(anon, `shops/${SHOP}/ics/${anonId}/calendar.ics`, 'text/calendar; charset=utf-8'));
await expectAllowed('customer: can replace that calendar file', upload(anon, `shops/${SHOP}/ics/${anonId}/calendar.ics`, 'text/calendar; charset=utf-8'));
await expectDenied('customer: cannot pile up more calendar files', upload(anon, `shops/${SHOP}/ics/${anonId}/1.ics`, 'text/calendar; charset=utf-8'));
await expectDenied("customer: cannot save a calendar file under someone else's id", upload(anon, `shops/${SHOP}/ics/someone/calendar.ics`, 'text/calendar; charset=utf-8'));
await expectDenied('customer: cannot save a non-calendar file there', upload(anon, `shops/${SHOP}/ics/${anonId}/2.html`, 'text/html'));
await expectAllowed('customer: can save own number and name', req(anon, 'PATCH', `shops/${SHOP}/users/${anonId}`, { fields: fields({ name: 'x', phone: '0521112233' }) }));
await expectDenied(
  "customer: cannot book under someone else's sign-in",
  commitUrl(anon, [
    put('appointments/b1', { ...appt, date: D6, customerPhone: '0521112233', customerUid: uidOf.get(me) }),
    put('days/' + D6, { busy: [{ id: 'b1', start: 600, end: 630 }] }),
  ]),
);
await expectAllowed(
  'customer: can book own appointment',
  commitUrl(anon, [
    put('appointments/b2', { ...appt, date: D6, customerPhone: '0521112233', customerUid: anonId }),
    put('days/' + D6, { busy: [{ id: 'b2', start: 600, end: 630 }] }),
  ]),
);
await expectAllowed('customer: can list own appointments', queryBy(anon, 'appointments', 'customerUid', anonId));
await expectDenied("customer: typing someone's number does not show his appointments", queryBy(anon, 'appointments', 'customerPhone', '0521112233'));
await expectDenied("customer: cannot read another customer's appointment", req(anon, 'GET', `shops/${SHOP}/appointments/a3`));
await expectDenied(
  "customer: cannot cancel another customer's appointment",
  commitUrl(anon, [
    put('appointments/a3', { ...appt, customerPhone: '0521112233', customerUid: uidOf.get(me), status: 'cancelled', cancelledBy: 'customer' }),
    put('days/' + D4, { busy: [{ id: 'w1', start: 700, end: 730 }] }),
  ]),
);
await expectAllowed(
  'customer: can cancel own appointment',
  commitUrl(anon, [
    put('appointments/b2', { ...appt, date: D6, customerPhone: '0521112233', customerUid: anonId, status: 'cancelled', cancelledBy: 'customer' }),
    put('days/' + D6, { busy: [] }),
  ]),
);
await expectAllowed(
  'customer: can join the waitlist',
  req(anon, 'PATCH', `shops/${SHOP}/waitlist/x2`, { fields: fields({ date: D4, customerPhone: '0521112233', customerUid: anonId }) }),
);
await expectDenied('customer: cannot read the whole waitlist', req(anon, 'GET', `shops/${SHOP}/waitlist`));
await expectAllowed(
  "customer: typing the admin's number gives no admin rights (profile only)",
  req(anon, 'PATCH', `shops/${SHOP}/users/${anonId}`, { fields: fields({ name: 'x', phone: adminPhones[0].replace(/\D/g, '') }) }),
);
await expectDenied('customer with the admin number typed: cannot change prices', req(anon, 'PATCH', `shops/${SHOP}/services/cut`, { fields: fields({ price: 1 }) }));
await expectDenied("customer with the admin number typed: cannot list everyone's appointments", req(anon, 'GET', `shops/${SHOP}/appointments`));
await expectDenied('customer with the admin number typed: cannot upload to the gallery', upload(anon, `shops/${SHOP}/gallery/y.jpg`));

console.log('\nBookings must look like the app made them');
await asOwner(`shops/${SHOP}/services/cut`, { name: 'x', price: 70, durationMin: 30, order: 0, priceHidden: false });
const anon2 = await signInAnon();
const anon2Id = uidOf.get(anon2);
const D7 = dayFromNow(7);
const bookAs = (tok, uid, id, a, busy) =>
  commitUrl(tok, [put(`appointments/${id}`, { ...appt, customerPhone: '0521112233', customerUid: uid, ...a }), put('days/' + a.date, { busy })]);
const one = (id, a) => bookAs(anon, anonId, id, a, [{ id, start: a.start, end: a.end }]);
await expectDenied('customer: cannot book a whole day', one('f1', { date: dayFromNow(8), start: 0, end: 1439 }));
await expectDenied('customer: cannot book longer than the service', one('f2', { date: dayFromNow(9), start: 600, end: 660 }));
await expectDenied('customer: cannot set his own price', one('f3', { date: dayFromNow(10), start: 600, end: 630, price: 0 }));
await expectDenied('customer: cannot book in the past', one('f4', { date: '2020-01-01', start: 600, end: 630 }));
await expectDenied('customer: cannot book years ahead', one('f5', { date: '2030-01-01', start: 600, end: 630 }));
await expectAllowed('customer: can book a normal slot', one('f6', { date: D7, start: 600, end: 630 }));
await expectDenied(
  'customer: cannot book over a taken slot',
  bookAs(anon2, anon2Id, 'f7', { date: D7, start: 615, end: 645 }, [
    { id: 'f6', start: 600, end: 630 },
    { id: 'f7', start: 615, end: 645 },
  ]),
);
await expectAllowed(
  'customer: can book right after a taken slot',
  bookAs(anon2, anon2Id, 'f8', { date: D7, start: 630, end: 660 }, [
    { id: 'f6', start: 600, end: 630 },
    { id: 'f8', start: 630, end: 660 },
  ]),
);
await expectAllowed(
  'customer: can move his own appointment to an overlapping time',
  commitUrl(anon, [
    put('appointments/f6', { ...appt, date: D7, start: 600, end: 630, customerPhone: '0521112233', customerUid: anonId, status: 'cancelled', cancelledBy: 'customer' }),
    put('appointments/f9', { ...appt, date: D7, start: 570, end: 600, customerPhone: '0521112233', customerUid: anonId }),
    put('days/' + D7, {
      busy: [
        { id: 'f8', start: 630, end: 660 },
        { id: 'f9', start: 570, end: 600 },
      ],
    }),
  ]),
);

if (trial) {
  console.log('\nTrial shops');
  await expectAllowed("anyone: can read a trial shop's details", req(null, 'GET', `trialShops/${SHOP}`));
  await expectDenied("customer: cannot change a trial shop's details", req(me, 'PATCH', `trialShops/${SHOP}`, { fields: fields({ adminPhonesE164: ['+972521112233'] }) }));
  await expectDenied("admin: cannot change a trial shop's details", req(admin, 'PATCH', `trialShops/${SHOP}`, { fields: fields({ brand: 'x' }) }));
  await expectAllowed('admin: can change own prices', req(admin, 'PATCH', `shops/${SHOP}/services/cut`, { fields: fields({ price: 80 }) }));
  await expectDenied("admin: cannot change another trial shop's prices", req(admin, 'PATCH', `shops/other-shop/services/cut`, { fields: fields({ price: 1 }) }));
  await expectDenied("admin: cannot upload to another trial shop's gallery", upload(admin, 'shops/other-shop/gallery/a.jpg'));
  await expectDenied('customer: cannot sign up to a shop that does not exist', req(me, 'PATCH', `shops/no-such-shop/users/x`, { fields: fields({ name: 'x' }) }));
  await expectAllowed('admin: can upload to own gallery', upload(admin, `shops/${SHOP}/gallery/a.jpg`));
  // The free week ends.
  await fetch(`${DOCS}/trialShops/${SHOP}?updateMask.fieldPaths=trialEndsAt`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: { trialEndsAt: ts('2020-01-01T00:00:00Z') } }),
  });
  await expectDenied(
    'customer: cannot book after the trial ended',
    commitUrl(me, [
      put('appointments/a9', { ...appt, date: D5, customerPhone: '0521112233', customerUid: uidOf.get(me) }),
      put('days/' + D5, { busy: [{ id: 'a9', start: 600, end: 630 }] }),
    ]),
  );
  await expectAllowed('admin: still sees the appointments after the trial ended', req(admin, 'GET', `shops/${SHOP}/appointments`));
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
