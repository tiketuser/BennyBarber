// End-to-end check of every feature, on a phone and on a desktop screen, in the bundled Chromium.
// Usage: npm run test:e2e            demo data (starts its own dev server on port 5199)
//        npm run test:e2e:firebase   the same steps against the Firebase emulators, with the real security rules
import { readFile } from 'node:fs/promises';
import { execSync, spawn } from 'node:child_process';
import { chromium, devices } from 'playwright';
import shop from '../shop.config.ts';

const ADMIN = shop.adminPhones[0].replace(/\D/g, '');
const FIREBASE = process.env.E2E_BACKEND === 'firebase';
const PROJECT = 'barber-bennycohen';
const PORT = 5199;
const URL = `http://localhost:${PORT}/`;
const env = { ...process.env, VITE_BACKEND: FIREBASE ? 'firebase' : 'demo', ...(FIREBASE && { VITE_FIREBASE_EMULATOR: '127.0.0.1' }) };
if (
  await fetch(URL).then(
    () => true,
    () => false,
  )
)
  throw new Error(`port ${PORT} is busy: stop the old dev server first`);
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', env, detached: true });
// Kill the whole group: npx -> vite would otherwise outlive us and keep the port.
const stop = () => {
  try {
    process.kill(-server.pid);
  } catch {
    /* already gone */
  }
};
process.on('exit', stop);

for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(URL)).ok) break;
  } catch {
    /* not up yet */
  }
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch();
const results = [];
let page;
let errors = [];

async function step(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log('  ✓', name);
  } catch (e) {
    results.push({ name, ok: false, error: e.message.split('\n')[0] });
    console.log('  ✗', name, '-', e.message.split('\n')[0]);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${results.length}.png` }).catch(() => {});
  }
}

/** Fresh emulator data for every screen size: empty accounts, the demo sample data in Firestore. */
async function resetFirebase() {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  execSync('npx vite-node e2e/seed-firebase.ts', { stdio: 'ignore' });
}

/** The SMS code the auth emulator "sent" to this number. */
async function smsCode(phone) {
  const e164 = '+972' + phone.replace(/\D/g, '').slice(1);
  for (let i = 0; i < 20; i++) {
    const { verificationCodes = [] } = await (await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/verificationCodes`)).json();
    const mine = verificationCodes.filter((c) => c.phoneNumber === e164);
    if (mine.length) return mine.at(-1).code;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('no SMS code from the emulator');
}

async function open(viewport) {
  if (FIREBASE) await resetFirebase();
  const ctx = await browser.newContext(viewport === 'phone' ? { ...devices['iPhone 13'], locale: 'he-IL' } : { viewport: { width: 1440, height: 950 }, locale: 'he-IL' });
  // wa.me / tel / calendar links: record instead of leaving the page.
  await ctx.addInitScript(() => {
    window.__opened = [];
    window.open = (url) => (window.__opened.push(String(url)), null);
    // Newer browsers return a promise from the scroll methods; behave like them so effects that leak it fail here.
    for (const m of ['scrollTo', 'scrollBy', 'scrollIntoView']) {
      const orig = Element.prototype[m];
      Element.prototype[m] = function (...a) {
        orig.apply(this, a);
        return Promise.resolve();
      };
    }
  });
  ctx.setDefaultTimeout(5000);
  page = await ctx.newPage();
  errors = [];
  // Under the emulators, reCAPTCHA can't reach Google and the auth emulator answers 501 to its config call: not app errors.
  const emulatorNoise = (t) => FIREBASE && /ERR_TUNNEL_CONNECTION_FAILED|status of 501/.test(t);
  page.on('console', (m) => m.type() === 'error' && !emulatorNoise(m.text()) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  return ctx;
}

const see = (text, opts) => page.getByText(text, opts).first().waitFor({ timeout: 4000 });
const tap = (text, opts) => page.getByText(text, opts).first().click();
const role = (r, name, opts = {}) => page.getByRole(r, { name, ...opts }).first();
const opened = () => page.evaluate(() => window.__opened);
const wait = (ms = 400) => page.waitForTimeout(ms);
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

async function login(phone, name) {
  await page.fill('#lphone', phone);
  await tap('שלח לי קוד');
  if (FIREBASE) await page.locator('input[autocomplete="one-time-code"]').waitFor();
  await page.fill('input[autocomplete="one-time-code"]', FIREBASE ? await smsCode(phone) : '123456');
  await wait(800);
  if (name) {
    await page.fill('input[autocomplete="name"]', name);
    await tap('שמור והמשך');
    await wait(500);
  }
  await tap(name ? 'לקביעת תור' : 'לתצוגת אדמין');
  await wait(500);
}

async function logout() {
  await role('button', 'התנתקות').click();
  await see('מה המספר שלך?');
}

// ---------------------------------------------------------------- phone
console.log('\nPhone');
let ctx = await open('phone');

await step('customer signs in with phone, code and name', async () => {
  await login('0521112233', 'דני בדיקה');
  await see('מה עושים היום?');
});

/** Drags the confirm thumb across, like a finger would. */
async function slideToConfirm() {
  await wait(600); // let the sheet settle before grabbing the thumb
  const t = await page.locator('[role=button][aria-label^="החלק לאישור"]').boundingBox();
  const [sx, sy] = [t.x + t.width - 30, t.y + t.height / 2];
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(sx - (i * t.width) / 20, sy);
    await wait(16);
  }
  await page.mouse.up();
}

await step('books an appointment with slide to confirm', async () => {
  await tap('תספורת גבר');
  await tap('בחירת יום ושעה');
  await wait(500);
  await page.locator('[aria-label="בחר יום"] [role=radio]:not([disabled])').nth(1).click();
  await wait(400);
  await page.locator('button.num[aria-pressed]').first().click();
  await tap('המשך');
  await see('כמעט סיימנו');
  await page.fill('#bnotes', 'פייד נמוך');
  await slideToConfirm();
  await see('נתראה במספרה!', { exact: false });
});

await step('ticket offers calendar, no WhatsApp to the shop, then goes home', async () => {
  await see('הוסף ליומן');
  expect(!(await page.getByText('שלח אישור לוואטסאפ').count()), 'WhatsApp confirmation button still shown');
  await tap('חזרה לדף הבית', { exact: false }).catch(() => tap('סיום'));
  await see('התור הקרוב שלך');
});

await step('reschedules and my appointments shows the new time right away', async () => {
  await role('button', 'התורים שלי').click();
  await see('הבא בתור');
  const before = await page.locator('article').first().innerText();
  await tap('שינוי מועד');
  await wait(500);
  await page.locator('[aria-label="בחר יום"] [role=radio]:not([disabled])').nth(3).click();
  await wait(400);
  const slot = page.locator('button.num[aria-pressed]').last();
  const time = await slot.innerText();
  await slot.click();
  await tap('המשך');
  await slideToConfirm();
  await see('נתראה במספרה!', { exact: false });
  await tap('חזרה לדף הבית', { exact: false }).catch(() => tap('סיום'));
  await role('button', 'התורים שלי').click();
  await see('הבא בתור');
  await wait(1500);
  const cards = page.locator("article");
  expect((await cards.count()) === 1, `expected one upcoming appointment, got ${await cards.count()}`);
  const after = await cards.first().innerText();
  expect(after.includes(time) && after !== before, `still shows the old time: ${after.replace(/\s+/g, ' ')}`);
});

await step('my appointments shows the booking and cancels it', async () => {
  await see('הבא בתור');
  await tap('ביטול');
  await tap('כן, לבטל');
  await see('התור בוטל');
});

await step('full day offers the waitlist, join and leave', async () => {
  await role('button', 'קביעת תור').click();
  await tap('תספורת גבר');
  await tap('בחירת יום ושעה');
  await wait(500);
  const full = page.locator('[aria-label="בחר יום"] [role=radio][aria-label$=" מלא"]:not([aria-label*="כמעט"])').first();
  await full.click();
  await wait(400);
  await tap('היום מלא? היכנס לרשימת המתנה');
  await see('אתה ברשימת ההמתנה');
  await tap('צא מהרשימה');
  await see('מתי יתאים לך אם יתפנה?');
});

await step('shop tab: gallery filters and course WhatsApp', async () => {
  await page
    .locator('button[aria-label="חזרה"]')
    .first()
    .click()
    .catch(() => {});
  await role('button', 'המספרה').click();
  await tap('לכל הגלריה');
  await wait(400);
  await role('button', 'התורים שלי').click({ trial: true }); // the tab bar stays reachable over the gallery
  await tap('זקן');
  await page.locator('button[aria-label="חזרה"]').first().click();
  await wait(400);
  await tap('רוצה ללמוד לספר?');
  await tap('כבר עובד');
  await role('button', 'שלח בוואטסאפ').click();
  expect(
    (await opened()).some((u) => decodeURIComponent(u).includes('כבר עובד')),
    'course message missing',
  );
  await page.locator('button[aria-label="חזרה"]').first().click();
  await wait(400);
});

await step('customer signs out', async () => {
  await tap('התנתקות');
  await see('מה המספר שלך?');
});

await step('admin signs in to the day view', async () => {
  await login(ADMIN);
  await see('חלונות פנויים');
});

await step('admin quick add, undo, and block', async () => {
  // Today may already be over, and the sample bookings fill some days: move ahead to the first day with a free slot.
  for (let i = 0; i < 10; i++) {
    await role('button', 'יום הבא').click();
    if (!(await page.locator('[aria-label="תור מהיר או חסימה"]').count())) continue;
    await page.locator('[aria-label="תור מהיר או חסימה"]').click();
    if (await page.locator('#walkin').waitFor({ timeout: 1500 }).then(() => true, () => false)) break;
    await page.keyboard.press('Escape');
    await wait(400);
  }
  await page.fill('#walkin', 'רון');
  await tap('הוסף ליומן מ-', { exact: false });
  await see('נוסף ליומן', { exact: false });
  await tap('ביטול');
  await wait(400);
  await page.locator('[aria-label="תור מהיר או חסימה"]').click();
  await page.getByRole('button', { name: '30 דק׳' }).click();
  await see('נחסם', { exact: false });
});

await step('admin services: price up, hide price, add and delete with undo', async () => {
  await role('button', 'שירותים ושעות').click();
  await role('button', 'העלה מחיר תספורת גבר').click();
  await see('₪75');
  await role('button', 'הסתר מחיר תספורת גבר מלקוחות').click();
  await tap('הוסף סוג תספורת');
  await page.locator('[role=dialog] input').first().fill('צבע לזקן');
  await page
    .locator('[role=dialog] button', { hasText: 'שמור' })
    .or(page.locator('[role=dialog] button', { hasText: 'הוסף' }))
    .last()
    .click();
  await see('צבע לזקן');
  await role('button', 'מחק צבע לזקן').click();
  await tap('ביטול');
  await see('צבע לזקן');
});

await step('admin history: search by name', async () => {
  await role('button', 'היסטוריה').click();
  await page.fill('#hsearch', 'כהן');
  await wait(300);
  expect((await page.locator('text=לא נמצאו תורים').count()) === 0, 'search found nothing');
});

await step('phone: no console errors', async () => expect(errors.length === 0, errors.join(' | ')));
await ctx.close();

// ---------------------------------------------------------------- desktop
console.log('\nDesktop');
ctx = await open('desk');

await step('desktop sign in shows the split screen', async () => {
  await see('נכנסים פעם אחת עם הנייד', { exact: false });
  await login('0524445566', 'משה דסק');
  await see('כמעט סיימנו');
});

await step('desktop books on one page with the "קבע תור" button', async () => {
  await page.locator('[aria-label="בחר יום"] [role=radio]:not([disabled])').nth(1).click();
  await wait(500);
  await page.locator('main button.num[aria-pressed=false]:not([disabled])').first().click();
  await page.fill('#dnotes', 'בלי מכונה');
  await page.locator('aside button', { hasText: 'קבע תור ל-' }).click();
  await see('התור נקבע!');
});

await step('desktop reschedules from my appointments', async () => {
  await tap('התורים שלי');
  await see('הבא בתור');
  await page.locator('article button', { hasText: 'שינוי מועד' }).click();
  await see('שינוי מועד');
  await page.locator('[aria-label="בחר יום"] [role=radio]:not([disabled])').nth(2).click();
  await wait(500);
  const slot = page.locator('main button.num[aria-pressed=false]:not([disabled])').last();
  const time = await slot.innerText();
  await slot.click();
  await page.locator('aside button', { hasText: 'העבר את התור ל-' }).click();
  await see('התור הועבר!');
  await wait(400);
  expect(!(await page.getByText('מזיזים את התור של').isVisible()), 'still offers to move the old appointment');
  await page.locator('nav button', { hasText: 'התורים שלי' }).click();
  await wait(1000);
  const shown = (await page.locator('article').allInnerTexts()).join(' | ');
  expect(shown.includes(time), `my appointments does not show ${time}: ${shown.replace(/\s+/g, ' ')}`);
});

await step('desktop cancels in place and undoes', async () => {
  await page.locator('nav button', { hasText: 'התורים שלי' }).click();
  await tap('ביטול התור');
  await tap('כן, לבטל');
  await see('התור בוטל');
  await tap('ביטלתי בטעות');
  await see('ביטול התור');
});

await step('desktop waitlist on a full day', async () => {
  await page.locator('nav button', { hasText: 'קביעת תור' }).click();
  await page.locator('[aria-label="בחר יום"] [role=radio][aria-label$="מלא"]:not([aria-label*="כמעט"])').first().click();
  await wait(400);
  await tap('היום מלא? היכנס לרשימת המתנה');
  await see('אתה ברשימת ההמתנה');
  await tap('צא מהרשימה');
});

await step('desktop shop page: gallery filter, course form', async () => {
  await page.locator('nav button', { hasText: 'קורס ספרות' }).click();
  await wait(800);
  // The section is last on the page: jumping to it must not push the whole app off-screen.
  expect((await page.locator('header nav').boundingBox()).y >= 0, 'header scrolled away');
  const shifted = await page.evaluate(() => {
    let e = document.getElementById('course')?.parentElement;
    while (e && !e.className.includes('overflow-y-auto')) e = e.parentElement;
    for (e = e?.parentElement; e; e = e.parentElement) if (e.scrollTop) return true;
    return false;
  });
  expect(!shifted, 'app shell scrolled');
  await page.locator('#course button', { hasText: 'שלח פרטים בוואטסאפ' }).click();
  await see('ההודעה מוכנה בוואטסאפ', { exact: false });
  await page.locator('nav button', { hasText: 'גלריה' }).click();
  await see('עבודות אחרונות');
  await page.getByRole('button', { name: 'ילדים' }).click();
});

await step('desktop customer signs out from the header', async () => logout());

await step('admin desktop: day dashboard with side menu', async () => {
  await login(ADMIN);
  await see('ברשימת המתנה');
  await role('button', 'יום הבא').click();
  await role('button', 'יום הבא').click();
  await role('button', 'יום הבא').click();
  await see('היומן');
});

await step('admin desktop: free windows panel and share', async () => {
  await page.locator('button', { hasText: 'חלונות פנויים ←' }).click();
  await wait(400);
  await page.keyboard.press('Escape');
});

await step('admin desktop: every booked appointment into the calendar at once', async () => {
  await role('button', 'כל התורים ליומן').click();
  await see('התורים הקבועים', { exact: false });
  const [download] = await Promise.all([page.waitForEvent('download'), role('button', 'יומן Google').click()]);
  const ics = await readFile(await download.path(), 'utf8');
  const events = ics.match(/BEGIN:VEVENT/g)?.length ?? 0;
  if (events < 2 || !ics.includes('TRIGGER:-PT15M') || !ics.includes('טלפון:')) throw new Error(`calendar file has ${events} events`);
  if (!(await opened()).some((u) => u.includes('calendar.google.com'))) throw new Error('Google import page not opened');
  await page.keyboard.press('Escape');
  await wait(400);
});

await step('admin desktop: quick add page adds a client with WhatsApp confirm', async () => {
  await page.locator('nav button', { hasText: 'תור מהיר' }).click();
  await page.fill('#qname', 'אבי בדיקה');
  await page.fill('#qphone', '0541234567');
  await page.locator('section button', { hasText: 'הוסף ליומן - ' }).click();
  await see('נוסף ליומן', { exact: false });
  expect(
    (await opened()).some((u) => u.includes('wa.me/972541234567')),
    'confirm WhatsApp not opened',
  );
  await tap('עוד אחד');
});

await step('admin desktop: quick block', async () => {
  await tap('חסימת זמן');
  await page.getByRole('button', { name: 'שעה' }).click();
  await page.locator('section button', { hasText: 'חסום ' }).click();
  await see('הזמן נחסם ביומן');
});

await step('admin desktop: services table add, hide, delete, undo', async () => {
  await page.locator('nav button', { hasText: 'שירותים ושעות' }).click();
  await tap('הוסף סוג תספורת');
  await page.fill('#newsvc', 'גוונים');
  await page.locator('[role=row] button', { hasText: 'הוסף' }).click();
  await see('גוונים');
  await role('button', 'הסתר מחיר מלקוחות - גוונים').click();
  await role('button', 'מחק - גוונים').click();
  await tap('ביטול');
  await see('גוונים');
});

await step('admin desktop: hours panel and break edit', async () => {
  await tap('ערוך שעות');
  await see('שעות פתיחה');
  await page.keyboard.press('Escape');
  await wait(300);
  await tap('ערוך הפסקה');
  await role('button', 'הפסקה ארוכה יותר').click();
  await tap('שמור הפסקה');
  await see('13:00 - 13:45');
});

await step('admin desktop: gallery upload, pin, delete with undo', async () => {
  // A real photo-sized PNG drawn in the page, as if picked from the computer's pictures.
  const png = await page.evaluate(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 2400, height: 1600 });
    const g = c.getContext('2d');
    g.fillStyle = '#7a5c3e';
    g.fillRect(0, 0, 2400, 1600);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.locator('button', { hasText: 'העלאה, מחיקה' }).click();
  const before = await page.locator('[role=dialog] img').count();
  await page.locator('[role=dialog] button', { hasText: 'זקן' }).click();
  await page.setInputFiles('input[type=file]', { name: 'cut.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await see('התמונה נוספה לגלריה');
  expect((await page.locator('[role=dialog] img').count()) === before + 1, 'photo not in the gallery');
  const src = await page.locator('[role=dialog] img').first().getAttribute('src');
  if (FIREBASE) {
    // Uploaded to Storage: the file there must be the shrunk JPEG.
    const res = await fetch(src);
    expect(res.headers.get('content-type') === 'image/jpeg' && (await res.arrayBuffer()).byteLength < 400000, 'photo was not shrunk');
  } else expect(src.startsWith('data:image/jpeg') && src.length < 400000, 'photo was not shrunk');
  await page.locator('[role=dialog] [aria-label="הוסף לנבחרות"]').first().click();
  await see('אפשר לבחור עד 4 תמונות', { exact: false });
  await page.locator('[role=dialog] [aria-label="מחק תמונה"]').first().click();
  await see('התמונה נמחקה');
  await tap('ביטול');
  await wait(300);
  expect((await page.locator('[role=dialog] img').count()) === before + 1, 'undo did not bring it back');
  await page.keyboard.press('Escape');
});

await step('admin desktop: vacation range with customer notice', async () => {
  await page.locator('aside button', { hasText: 'ימי חופש' }).click();
  const days = page.locator('[aria-label="בחירת ימים"] button[aria-label*="תורים"]:not([disabled])');
  await days.nth(3).click();
  await days.nth(4).click();
  await see('תורים שיבוטלו');
  await page.locator('aside button', { hasText: 'כחופש' }).click();
  await see('החופש נשמר');
  await page.locator('aside button', { hasText: 'שלח' }).first().click();
  expect(
    (await opened()).some((u) => decodeURIComponent(u).includes('המספרה סגורה')),
    'vacation notice not opened',
  );
});

await step('admin desktop: history paging and search', async () => {
  await page.locator('nav button', { hasText: 'היסטוריה' }).click();
  await role('button', '6 חודשים קודמים').click();
  await role('button', '6 חודשים הבאים').click();
  await page.fill('#dhsearch', 'לוי');
  await wait(300);
  expect((await page.locator('text=לא נמצאו תורים').count()) === 0, 'search found nothing');
});

await step('admin desktop signs out', async () => logout());
await step('desktop: no console errors', async () => expect(errors.length === 0, errors.join(' | ')));
await ctx.close();

await browser.close();
stop();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
