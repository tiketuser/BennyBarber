// End-to-end check of every feature, on a phone and on a desktop screen, in the bundled Chromium.
// Usage: npm run test:e2e   (starts its own dev server on port 5199)
import { spawn } from 'node:child_process';
import { chromium, devices } from 'playwright';

const PORT = 5199;
const URL = `http://localhost:${PORT}/`;
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const stop = () => server.kill();
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

async function open(viewport) {
  const ctx = await browser.newContext(viewport === 'phone' ? { ...devices['iPhone 13'], locale: 'he-IL' } : { viewport: { width: 1440, height: 950 }, locale: 'he-IL' });
  // wa.me / tel / calendar links: record instead of leaving the page.
  await ctx.addInitScript(() => {
    window.__opened = [];
    window.open = (url) => (window.__opened.push(String(url)), null);
  });
  ctx.setDefaultTimeout(5000);
  page = await ctx.newPage();
  errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
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
  await page.fill('input[autocomplete="one-time-code"]', '1234');
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
  await wait(600); // let the sheet settle before grabbing the thumb
  // Drag the thumb across, like a finger would.
  const t = await page.locator('[role=button][aria-label^="החלק לאישור"]').boundingBox();
  const [sx, sy] = [t.x + t.width - 30, t.y + t.height / 2];
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(sx - (i * t.width) / 20, sy);
    await wait(16);
  }
  await page.mouse.up();
  await see('נתראה במספרה!', { exact: false });
});

await step('ticket offers calendar and WhatsApp, then goes home', async () => {
  await tap('שלח אישור לוואטסאפ');
  expect(
    (await opened()).some((u) => u.includes('wa.me')),
    'WhatsApp not opened',
  );
  await tap('חזרה לדף הבית', { exact: false }).catch(() => tap('סיום'));
  await see('התור הקרוב שלך');
});

await step('my appointments shows the booking and cancels it', async () => {
  await role('button', 'התורים שלי').click();
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
  await login('0500000000');
  await see('חלונות פנויים');
});

await step('admin quick add, undo, and block', async () => {
  // Today may already be over: move to Sunday, which is always open in the demo hours.
  for (let i = 0; i < 7 && !(await page.getByText('יום א׳', { exact: false }).count()); i++) await role('button', 'יום הבא').click();
  await page.locator('[aria-label="תור מהיר או חסימה"]').click();
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
  await page.locator('main button.num[aria-pressed=false]:not([disabled])').first().click();
  await page.locator('aside button', { hasText: 'העבר את התור ל-' }).click();
  await see('התור הועבר!');
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
  await page.locator('nav button', { hasText: 'גלריה' }).click();
  await see('עבודות אחרונות');
  await page.getByRole('button', { name: 'ילדים' }).click();
  await page.locator('nav button', { hasText: 'קורס ספרות' }).click();
  await page.locator('#course button', { hasText: 'שלח פרטים בוואטסאפ' }).click();
  await see('ההודעה מוכנה בוואטסאפ', { exact: false });
});

await step('desktop customer signs out from the header', async () => logout());

await step('admin desktop: day dashboard with side menu', async () => {
  await login('0500000000');
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

await step('admin desktop: gallery pins panel', async () => {
  await tap('תמונות נבחרות בדף המספרה');
  await wait(400);
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
