#!/usr/bin/env node
// מוצא מספרות קטנות שאין להן אתר ואין להן מערכת תורים, ומכין קובץ לידים עם הודעת פתיחה.
// בודק שלושה מקומות לכל מספרה:
//   1. גוגל מפות: שדה האתר (וגם נכנס אליו אם זה linktree / קיצור קישור)
//   2. האינסטגרם שלו: הביו, הקישור בביו וכל הקישורים בביו
//   3. כל קישור שנמצא בביו: נכנס אליו ומחפש מערכת תורים (קלמרק, סמארטור, איזיטור, Booksy וכו')
// נשארים רק מי שאין לו אתר ואין לו מערכת תורים, כלומר קובע בוואטסאפ או בטלפון, ושהוא קטן (לא רשת).
//
// הרצה (Node 18 ומעלה, בלי התקנות). חייבים להריץ מהמחשב שלך: אינסטגרם חוסם שרתים בענן.
//   node find-barbers.mjs                                   (משתמש בתוצאות גוגל ששמורות ב-cache.json, בלי עלות)
//   GOOGLE_MAPS_API_KEY=xxxx node find-barbers.mjs --cities "חולון,בת ים"   (מחפש גם ערים חדשות בגוגל)
//   node find-barbers.mjs --only "חולון,בת ים,ראשון לציון"  (הפלט רק לערים האלה)
//
// בדיקת אינסטגרם: בקשה כל ~4 שניות, ואם אינסטגרם מאט אותנו הסקריפט מחכה וממשיך.
// הכל נשמר ב-cache.json, אז אפשר לעצור (Ctrl+C) ולהריץ שוב, והוא ממשיך מאיפה שעצר.
//
// עלות גוגל: כל בקשה היא "Text Search Enterprise", 1,000 חינם בחודש. הסקריפט עוצר ב-900 (--max-calls).
//
// פלט:
//   leads.csv  - נפתח באקסל / גוגל שיטס. בראש: מי שמתאים (keep), אחר כך מי שירד ולמה.
//   leads.json - אותו דבר

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, []),
);

const KEY = process.env.GOOGLE_MAPS_API_KEY;
const MAX_CALLS = Number(args['max-calls'] ?? 900);
const OUT_DIR = args.out ?? HERE;
const CACHE_FILE = path.join(OUT_DIR, 'cache.json');
const MAX_REVIEWS = Number(args['max-reviews'] ?? 150); // מעל זה זו כבר לא מספרה קטנה
const MAX_FOLLOWERS = Number(args['max-followers'] ?? 15000);
const IG_DELAY = Number(args['ig-delay'] ?? 4000);

const DEFAULT_CITIES = [
  'ירושלים', 'תל אביב', 'חיפה', 'ראשון לציון', 'פתח תקווה', 'אשדוד', 'נתניה', 'באר שבע', 'בני ברק', 'חולון',
  'רמת גן', 'רחובות', 'אשקלון', 'בת ים', 'בית שמש', 'כפר סבא', 'הרצליה', 'חדרה', 'מודיעין', 'נצרת',
  'לוד', 'רמלה', 'רעננה', 'רהט', 'הוד השרון', 'גבעתיים', 'קריית גת', 'נהריה', 'עפולה', 'קריית אתא',
  'יבנה', 'אילת', 'עכו', 'אום אל פחם', 'קריית מוצקין', 'קריית ביאליק', 'קריית ים', 'רמת השרון', 'ראש העין', 'נס ציונה',
  'טבריה', 'כרמיאל', 'קריית שמונה', 'דימונה', 'נתיבות', 'שדרות', 'אופקים', 'אור יהודה', 'יהוד', 'קריית אונו',
  'גדרה', 'גן יבנה', 'קריית מלאכי', 'טירת כרמל', 'נשר', 'מגדל העמק', 'צפת', 'בית שאן', 'אריאל', 'מעלה אדומים',
  'ביתר עילית', 'אלעד', 'שוהם', 'זכרון יעקב', 'פרדס חנה כרכור', 'אור עקיבא', 'קיסריה', 'טייבה', 'טמרה', 'שפרעם',
];
const cities = args.cities ? String(args.cities).split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_CITIES;
const only = args.only ? String(args.only).split(',').map((s) => s.trim()).filter(Boolean) : null;
const QUERIES = (city) => [`ברברשופ ב${city}`, `מספרה לגברים ב${city}`];

const FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.nationalPhoneNumber',
  'places.websiteUri', 'places.googleMapsUri', 'places.rating', 'places.userRatingCount',
  'places.businessStatus', 'places.primaryType', 'places.types', 'nextPageToken',
].join(',');

// מערכות תורים שספרים בישראל משתמשים בהן. מספיק שהמילה מופיעה בכתובת או בקישור.
const BOOKING_SITES = [
  ['calmark', 'קלמרק'], ['cal.mk', 'קלמרק'], ['smartor', 'סמארטור'], ['eztor', 'איזיטור'], ['easytor', 'איזיטור'],
  ['ezbz', 'EZBZ'], ['tor4you', 'Tor4You'], ['mytor', 'MyTor'], ['simpletor', 'SimpleTor'], ['tormahir', 'תור מהיר'],
  ['megator', 'מגהתור'], ['tor.co.il', 'תור'], ['torli', 'תורלי'], ['lee.co.il', 'Lee'], ['dibs-app', 'Dibs'],
  ['broadcust', 'Broadcust'], ['kavanu', 'כוונו'], ['tiffulit', 'תפעולית'], ['easybizy', 'EasyBizy'],
  ['plannieapp', 'Plannie'], ['plusfive', 'PlusFive'], ['heygoldie', 'Goldie'], ['cali-', 'Cali'],
  ['booksy', 'Booksy'], ['fresha', 'Fresha'], ['setmore', 'Setmore'], ['bizzer', 'Bizzer'], ['appointo', 'Appointo'],
  ['simplybook', 'SimplyBook'], ['calendly', 'Calendly'], ['timely', 'Timely'], ['vagaro', 'Vagaro'],
  ['squareup.com/appointments', 'Square'], ['zimuntor', 'זימון תור'], ['tori.co.il', 'תורי'],
  ['apps.apple.com', 'אפליקציה משלו'], ['play.google.com', 'אפליקציה משלו'],
  ['book-online', 'הזמנה באתר (Wix)'], ['/booking', 'הזמנה באתר'], ['bookings', 'הזמנה באתר'],
];
const findBooking = (text) => BOOKING_SITES.find(([k]) => (text || '').toLowerCase().includes(k))?.[1];

// קישורים שהם לא אתר של המספרה עצמה
const SOCIAL = ['instagram.com', 'facebook.com', 'fb.com', 'fb.me', 'tiktok.com', 'wa.me', 'whatsapp.com', 'waze.com', 'goo.gl/maps', 'maps.app.goo.gl', 'google.com/maps', 'youtube.com', 'threads.net'];
// דפי "קישור בביו" וקיצורי קישור: נכנסים אליהם ובודקים מה יש בפנים
const LINK_PAGES = ['linktr.ee', 'linkin.bio', 'lnk.bio', 'bio.link', 'taplink', 'beacons.ai', 'msha.ke', 'linkr.bio', 'campsite.bio', 'solo.to', 'bama.bio', 'did.li', 'tinyurl.com', 'bit.ly', 'l.facebook.com', 'l.instagram.com', 'linkme', 'heylink.me', 'allmylinks'];
// אינדקסים וקניונים: דף שמישהו אחר פתח לו, לא אתר שלו
const DIRECTORIES = ['d.co.il', 'easy.co.il', 'b144.co.il', 'israelbusinessguide', 'zapages', 'azrielimalls', 'bigcenters', 'mivnecenters', 'amot.co.il', 'myofer', 'payngo', 'zooeretz', 'google.co.il', 'sites.google.com'];

const has = (url, list) => list.some((d) => (url || '').toLowerCase().includes(d));

// מילים בביו שמראות שהוא מפנה לקביעת תור אונליין / שהוא קובע בוואטסאפ ובטלפון
const BIO_ONLINE = /(link in bio|book now|book online|online booking|לקביעת תור(ים)? (ב|ל)?(קישור|לינק|אתר|אפליקציה)|תורים (ב|ל)?(קישור|לינק|אתר|אפליקציה)|זימון תורים אונליין|הזמנת תור(ים)? אונליין|קביעת תור(ים)? אונליין|בלינק בביו|בקישור בביו)/i;
const BIO_PHONE = /(וואטסאפ|ווטסאפ|ווצאפ|וואצאפ|whatsapp|בטלפון|טלפון|בהודעה|בפרטי|dm|0[5-9]\d[-\s]?\d{3}[-\s]?\d{4})/i;

function instagramHandle(url) {
  const m = url?.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  return m && !['p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'tv'].includes(m[1].toLowerCase()) ? m[1] : '';
}

function israeliToIntl(phone) {
  const d = (phone || '').replace(/\D/g, '');
  return d.startsWith('0') ? `972${d.slice(1)}` : d;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

// נכנס לכתובת ומחזיר: מערכת תורים אם נמצאה, האם זה אתר אמיתי, ואינסטגרם אם יש קישור אליו
async function scanUrl(url) {
  if (!url || has(url, SOCIAL)) return { booking: '', site: false, instagram: instagramHandle(url) };
  const direct = findBooking(url);
  if (direct) return { booking: direct, site: false, instagram: '' };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000), redirect: 'follow', headers: { 'User-Agent': UA } });
    const html = (await res.text()).slice(0, 2_000_000);
    const links = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]).join(' ');
    const final = res.url || url;
    const booking = findBooking(final) || findBooking(links) || '';
    const linkPage = has(url, LINK_PAGES) || has(final, LINK_PAGES);
    // דף קישורים: אתר אמיתי רק אם יש בו קישור לאתר שהוא לא רשת חברתית/מדריך/מערכת תורים
    const ownSite = linkPage
      ? [...links.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) => m[0]).some((u) => !has(u, SOCIAL) && !has(u, LINK_PAGES) && !has(u, DIRECTORIES) && !findBooking(u) && !has(u, ['linktr.ee', 'cdn', 'static', 'fonts.', 'schema.org', 'w3.org']))
      : !has(final, DIRECTORIES) && !has(final, SOCIAL);
    return { booking, site: !booking && ownSite && res.ok, instagram: instagramHandle(links), url: final };
  } catch {
    return { booking: '', site: false, instagram: '', error: true };
  }
}

// פרופיל אינסטגרם ציבורי: ביו, קישורים בביו, עוקבים. בלי התחברות.
let igBlockedUntil = 0;
let igFailures = 0;
async function igProfile(handle) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = igBlockedUntil - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      const res = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': UA, 'x-ig-app-id': '936619743392459', Accept: '*/*', Referer: `https://www.instagram.com/${handle}/` },
      });
      if (res.status === 404) return { missing: true };
      if (res.status === 429 || res.status === 401 || res.status === 403) {
        const pause = 60_000 * 2 ** attempt; // 1, 2, 4, 8 דקות
        console.log(`  אינסטגרם מאט אותנו (${res.status}), מחכה ${pause / 60000} דק'...`);
        igBlockedUntil = Date.now() + pause;
        continue;
      }
      const body = await res.json().catch(() => null);
      const u = body?.data?.user;
      if (!u) return { missing: true };
      igFailures = 0;
      const links = [u.external_url, ...(u.bio_links ?? []).map((l) => l.url)].filter(Boolean);
      return {
        bio: u.biography ?? '',
        links: [...new Set(links)],
        followers: u.edge_followed_by?.count ?? 0,
        name: u.full_name ?? '',
        category: u.category_name ?? u.business_category_name ?? '',
      };
    } catch {
      await sleep(5000);
    }
  }
  igFailures++;
  return null; // לא הצלחנו עכשיו, ננסה בהרצה הבאה
}

// מחפש את האינסטגרם של מספרה שאין לה קישור אליו בגוגל מפות (חיפוש DuckDuckGo, חינם)
async function findInstagram(name, city) {
  const q = `${name.split(/ - | \| |–/)[0]} ${city} site:instagram.com`;
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': UA } });
    const html = await res.text();
    const urls = [...html.matchAll(/instagram\.com%2F([A-Za-z0-9._]+)|instagram\.com\/([A-Za-z0-9._]+)/g)].map((m) => m[1] || m[2]);
    if (!res.ok) return null;
    return urls.map((h) => instagramHandle(`instagram.com/${h}`)).find(Boolean) || '';
  } catch {
    return null; // החיפוש נכשל, ננסה בהרצה הבאה
  }
}

// הודעות פתיחה (הנוסח של אביב, בלי סימני פיסוק). שולחים ברצף, כל אחת בנפרד.
const OPENER_IG = [
  'מה איתך אחי',
  'קוראים לי אביב יצא לי לראות את התספורות שלך באינסטגרם אהבתי ובניתי לך אפליקציה לקביעת תורים וניהול של המספרה',
  'רציתי לשאול אם תרצה לראות איך יצא כמובן שבחינם\nואם יעניין אותך אפשר לדבר',
];
const OPENER_WA = [OPENER_IG[0], 'קוראים לי אביב ראיתי את המספרה שלך בגוגל ובניתי לך אפליקציה לקביעת תורים וניהול של המספרה', OPENER_IG[2]];

async function textSearch(query, pageToken) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify({ textQuery: query, languageCode: 'he', regionCode: 'IL', pageSize: 20, ...(pageToken && { pageToken }) }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Places API ${res.status}: ${JSON.stringify(body.error ?? body)}`);
  return body;
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ההחלטה: מתאים (keep) או לא, ולמה
function decide(p, chainNames) {
  const reviews = p.userRatingCount ?? 0;
  const name = p.displayName?.text ?? '';
  const ig = p.ig && !p.ig.missing ? p.ig : null;
  const bioScans = p.bioScans ?? [];
  const mapsBooking = p.scan?.booking || findBooking(p.websiteUri);
  const bioBooking = bioScans.find((s) => s.booking)?.booking || ig?.links?.map(findBooking).find(Boolean);

  if (p.businessStatus === 'CLOSED_TEMPORARILY') return ['drop', 'סגור זמנית'];
  if (mapsBooking) return ['drop', `מערכת תורים בגוגל מפות: ${mapsBooking}`];
  if (bioBooking) return ['drop', `מערכת תורים בביו באינסטגרם: ${bioBooking}`];
  if (p.scan?.site) return ['drop', 'יש אתר (בגוגל מפות)'];
  if (bioScans.some((s) => s.site)) return ['drop', 'יש אתר (בביו באינסטגרם)'];
  if (ig && BIO_ONLINE.test(ig.bio)) return ['drop', 'הביו מפנה לקביעת תור אונליין'];
  if (p.websiteUri && p.scan?.error && !has(p.websiteUri, SOCIAL) && !has(p.websiteUri, DIRECTORIES)) return ['drop', 'יש אתר בגוגל מפות (לא נפתח, כנראה אתר)'];
  if (chainNames.has(baseName(name))) return ['drop', 'רשת / כמה סניפים'];
  if (reviews > MAX_REVIEWS) return ['drop', `גדולה (${reviews} ביקורות)`];
  if (ig && ig.followers > MAX_FOLLOWERS) return ['drop', `גדולה (${ig.followers} עוקבים)`];
  if (!ig) return ['keep', p.igHandle ? 'בלי אתר; האינסטגרם לא נבדק עדיין' : 'בלי אתר; לא נמצא אינסטגרם'];
  return ['keep', BIO_PHONE.test(ig.bio) || ig.links.some((l) => has(l, ['wa.me', 'whatsapp'])) ? 'בלי אתר; קובע בוואטסאפ/טלפון' : 'בלי אתר ובלי קישור לתורים'];
}
const baseName = (n) => n.split(/ - | \| |–|,/)[0].replace(/סניף.*$/, '').trim().toLowerCase();

async function main() {
  const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : { queries: {}, places: {} };
  const save = () => fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  let calls = 0;

  // 1. חיפוש בגוגל מפות (רק ערים שעוד לא נסרקו)
  const todo = cities.flatMap(QUERIES).filter((q) => !cache.queries[q]);
  if (todo.length && !KEY) console.log(`יש ${todo.length} חיפושים חדשים בגוגל שלא ירוצו בלי GOOGLE_MAPS_API_KEY. ממשיך עם מה ששמור.`);
  outer: for (const q of KEY ? todo : []) {
    let token;
    let page = 0;
    do {
      if (calls >= MAX_CALLS) {
        console.log(`עצרתי ב-${calls} בקשות לגוגל (המגבלה).`);
        break outer;
      }
      const body = await textSearch(q, token);
      calls++;
      const city = cities.find((c) => q.endsWith(c));
      for (const p of body.places ?? []) if (!cache.places[p.id]) cache.places[p.id] = { ...p, city };
      token = body.nextPageToken;
      page++;
      if (token) await sleep(1500);
    } while (token && page < 3);
    cache.queries[q] = new Date().toISOString();
    save();
    console.log(`${q}: סה"כ ${Object.keys(cache.places).length} מקומות`);
  }

  const HAIR = ['barber_shop', 'hair_salon', 'hair_care', 'beauty_salon'];
  let places = Object.values(cache.places)
    .filter((p) => p.businessStatus !== 'CLOSED_PERMANENTLY')
    .filter((p) => (p.types ?? []).some((t) => HAIR.includes(t)))
    .filter((p) => !p.primaryType || HAIR.includes(p.primaryType));
  if (only) places = places.filter((p) => only.some((c) => p.city === c || (p.formattedAddress ?? '').includes(c)));

  const counts = {};
  for (const p of Object.values(cache.places)) counts[baseName(p.displayName?.text ?? '')] = (counts[baseName(p.displayName?.text ?? '')] ?? 0) + 1;
  const chainNames = new Set(Object.entries(counts).filter(([n, c]) => c >= 3 && n.length > 2).map(([n]) => n));

  // 2. האתר בגוגל מפות (גרסה 2: מכיר יותר מערכות תורים ונכנס לדפי linktree)
  const toScan = places.filter((p) => p.websiteUri && p.scanV !== 2);
  if (toScan.length) console.log(`בודק ${toScan.length} קישורים מגוגל מפות...`);
  for (let i = 0; i < toScan.length; i += 8) {
    await Promise.all(toScan.slice(i, i + 8).map(async (p) => { p.scan = await scanUrl(p.websiteUri); p.scanV = 2; }));
    save();
  }

  // 3. אינסטגרם: רק למי שעדיין יכול להתאים (אין לו כבר אתר/מערכת תורים בגוגל, ולא גדול)
  const candidates = places.filter((p) => {
    const [d] = decide({ ...p, ig: undefined, bioScans: [] }, chainNames);
    return d === 'keep';
  });
  for (const p of candidates) p.igHandle ??= instagramHandle(p.websiteUri) || p.scan?.instagram || '';

  const noHandle = candidates.filter((p) => !p.igHandle && !p.igSearched);
  if (noHandle.length) console.log(`מחפש אינסטגרם ל-${noHandle.length} מספרות שאין להן קישור בגוגל...`);
  for (const [i, p] of noHandle.entries()) {
    const found = await findInstagram(p.displayName?.text ?? '', p.city);
    if (found === null) continue;
    p.igHandle = found;
    p.igSearched = true;
    if (i % 10 === 9) { save(); console.log(`  ${i + 1}/${noHandle.length}`); }
    await sleep(1500);
  }
  save();

  const toIg = candidates.filter((p) => p.igHandle && !p.ig);
  if (toIg.length) console.log(`בודק ${toIg.length} פרופילים באינסטגרם (בערך ${Math.ceil((toIg.length * IG_DELAY) / 60000)} דק')...`);
  for (const [i, p] of toIg.entries()) {
    if (igFailures >= 5) {
      console.log('אינסטגרם חוסם כרגע. מה שנבדק נשמר; להריץ שוב מאוחר יותר כדי להמשיך.');
      break;
    }
    const ig = await igProfile(p.igHandle);
    if (ig) {
      p.ig = ig;
      // 4. כל קישור בביו: נכנסים ובודקים
      p.bioScans = [];
      for (const link of ig.links ?? []) p.bioScans.push(await scanUrl(link));
    }
    if (i % 10 === 9) { save(); console.log(`  ${i + 1}/${toIg.length}`); }
    await sleep(IG_DELAY);
  }
  save();

  // 5. פלט
  const leads = places
    .map((p) => {
      const [decision, reason] = decide(p, chainNames);
      const handle = p.ig && !p.ig.missing ? p.igHandle : '';
      const name = p.displayName?.text ?? '';
      const intl = israeliToIntl(p.nationalPhoneNumber);
      const mobile = /^9725/.test(intl);
      const opener = decision !== 'keep' ? ['', '', ''] : handle ? OPENER_IG : OPENER_WA;
      return {
        decision,
        reason,
        name,
        kind: p.primaryType === 'barber_shop' ? 'ברברשופ' : 'סלון',
        city: p.city,
        address: p.formattedAddress ?? '',
        phone: p.nationalPhoneNumber ?? '',
        rating: p.rating ?? '',
        reviews: p.userRatingCount ?? 0,
        website: p.websiteUri ?? '',
        instagram: handle,
        ig_followers: p.ig?.followers ?? '',
        ig_bio: (p.ig?.bio ?? '').replace(/\s+/g, ' ').slice(0, 200),
        ig_links: (p.ig?.links ?? []).join(' '),
        dm_link: handle ? `https://ig.me/m/${handle}` : '',
        whatsapp_link: mobile ? `https://wa.me/${intl}` : '',
        maps: p.googleMapsUri ?? '',
        opener_1: opener[0],
        opener_2: opener[1],
        opener_3: opener[2],
        sent_on: '',
        result: '',
      };
    })
    .sort((a, b) => (a.decision === b.decision ? 0 : a.decision === 'keep' ? -1 : 1) || (a.kind === b.kind ? 0 : a.kind === 'ברברשופ' ? -1 : 1) || b.reviews - a.reviews);

  const cols = Object.keys(leads[0] ?? { name: '' });
  const csv = '﻿' + [cols.join(','), ...leads.map((l) => cols.map((c) => csvCell(l[c])).join(','))].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'leads.csv'), csv);
  fs.writeFileSync(path.join(OUT_DIR, 'leads.json'), JSON.stringify(leads, null, 2));

  const keep = leads.filter((l) => l.decision === 'keep');
  const reasons = {};
  for (const l of leads.filter((x) => x.decision === 'drop')) {
    const r = l.reason.replace(/: .*$/, '').replace(/ \(\d+.*\)$/, '');
    reasons[r] = (reasons[r] ?? 0) + 1;
  }
  console.log(`\nבקשות לגוגל בהרצה הזאת: ${calls}`);
  console.log(`מספרות: ${leads.length}. מתאימות: ${keep.length}. ירדו: ${leads.length - keep.length}`);
  for (const [r, c] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) console.log(`  ירדו - ${r}: ${c}`);
  const kr = {};
  for (const l of keep) kr[l.reason] = (kr[l.reason] ?? 0) + 1;
  for (const [r, c] of Object.entries(kr)) console.log(`  מתאימות - ${r}: ${c}`);
  console.log(`נשמר ב-${path.join(OUT_DIR, 'leads.csv')}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
