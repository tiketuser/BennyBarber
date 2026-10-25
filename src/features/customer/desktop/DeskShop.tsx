import { useState } from 'react';
import { Instagram, MapPin, MessageCircle, Navigation, Phone } from 'lucide-react';
import { useDb, useNow, useSession } from '@/data/store';
import type { GalleryCategory } from '@/domain/types';
import { SHOP, g } from '@/config/shop';
import { telUrl, whatsappUrl } from '@/lib/links';
import { formatPhone, isValidMobile } from '@/lib/phone';
import { openExternal } from '@/lib/platform';
import { todayKey, weekdayOf } from '@/lib/time';
import { cx } from '@/ui/cx';
import { GalleryTile } from '../../shared/GalleryTile';
import { groupHours } from '../../shared/hours';
import { useOpenStatus } from '../hooks';
import { GALLERY_FILTERS } from '../../shared/gallery';

export type ShopSection = 'gallery' | 'course';

const EXPERIENCE = ['אין בכלל', 'קצת', 'כבר עובד'] as const;

/** The shop as one page: hero with hours and contact, gallery with filters, course lead form. */
export function DeskShop({ onBook }: { onBook: () => void }) {
  const db = useDb();
  const now = useNow();
  const status = useOpenStatus();
  const wd = weekdayOf(todayKey(now));
  const [filter, setFilter] = useState<GalleryCategory | 'all'>('all');
  const photos = [...db.gallery].filter((g) => filter === 'all' || g.category === filter).sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order);

  return (
    <>
      <main className="mx-auto flex max-w-[1240px] flex-col gap-14 px-8 pb-[72px] pt-10">
        <section className="flex flex-wrap items-stretch gap-8">
          <div className="flex flex-[1_1_520px] flex-col justify-center gap-5">
            <span
              className={cx(
                'flex h-8 items-center gap-1.5 self-start rounded-full px-3 text-[13px] font-semibold',
                status.open ? 'bg-open-soft text-open-text' : 'bg-surface text-ink-soft',
              )}
            >
              <span className={cx('size-2 rounded-full', status.open ? 'bg-open-dot' : 'bg-ink-faint')} />
              {status.open ? `פתוח עכשיו • עד ${status.closesAt}` : status.text}
            </span>
            <h1 className="m-0 font-brand text-[56px] font-normal leading-[1.05]">
              {SHOP.brand}
              <br />
              {SHOP.kind}
            </h1>
            <p className="m-0 max-w-[46ch] text-lg leading-relaxed text-ink-soft">{SHOP.tagline}</p>
            <div className="flex flex-wrap gap-2.5">
              <button type="button" onClick={onBook} className="press flex h-12 items-center rounded-[14px] bg-brand px-5 text-[15px] font-semibold text-brand-accent">
                לקביעת תור
              </button>
              <button
                type="button"
                onClick={() => openExternal(SHOP.wazeUrl)}
                className="press flex h-12 items-center gap-2 rounded-[14px] border border-line px-[18px] text-[15px] font-semibold hover:border-ink-faint"
              >
                <Navigation size={20} />
                ניווט ב-Waze
              </button>
              <button
                type="button"
                onClick={() => openExternal(whatsappUrl(SHOP.phone, 'היי, '))}
                className="press flex h-12 items-center gap-2 rounded-[14px] bg-open px-[18px] text-[15px] font-semibold text-white"
              >
                <MessageCircle size={20} />
                {g('שלח וואטסאפ', 'שלחי וואטסאפ', 'שלחו וואטסאפ')}
              </button>
              <button
                type="button"
                onClick={() => openExternal(telUrl(SHOP.phone))}
                className="press flex h-12 items-center gap-2 rounded-[14px] border border-line px-[18px] text-[15px] font-semibold hover:border-ink-faint"
              >
                <Phone size={20} />
                התקשר
              </button>
            </div>
          </div>
          <div className="grid flex-[1_1_420px] grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-3 rounded-[22px] bg-surface p-[22px]">
              <span className="text-[15px] font-bold">שעות פתיחה</span>
              <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
                {groupHours(db.settings).map((r) => (
                  <div key={r.label} className={cx('contents', r.days.includes(wd) && '[&>*]:font-bold')}>
                    <span className="text-ink-soft">{r.label}</span>
                    <span dir="ltr" className={cx('num text-right font-semibold', !r.open && 'text-ink-faint')}>
                      {r.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => openExternal(SHOP.mapsUrl)}
              className={cx('flex flex-col gap-1.5 rounded-[22px] border border-line p-[22px] text-right hover:border-ink-faint', !SHOP.instagramUrl && 'col-span-2')}
            >
              <MapPin size={22} />
              <span className="mt-1.5 text-[15px] font-bold">{SHOP.street}</span>
              <span className="text-sm text-ink-soft">{SHOP.city} • פתיחה במפות</span>
            </button>
            {SHOP.instagramUrl && (
              <button
                type="button"
                onClick={() => openExternal(SHOP.instagramUrl!)}
                className="flex flex-col gap-1.5 rounded-[22px] border border-line p-[22px] text-right hover:border-ink-faint"
              >
                <Instagram size={22} />
                <span dir="ltr" className="mt-1.5 text-right text-[15px] font-bold">
                  @{SHOP.instagram}
                </span>
                <span className="text-sm text-ink-soft">עבודות חדשות כל שבוע</span>
              </button>
            )}
          </div>
        </section>

        <section id="gallery" aria-labelledby="h-gal" className="flex flex-col gap-[18px]">
          <div className="flex items-center gap-3">
            <h2 id="h-gal" className="m-0 text-[26px] font-bold">
              עבודות אחרונות
            </h2>
            <div aria-label="סינון" className="mr-4 flex gap-2">
              {GALLERY_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={cx(
                    'h-[38px] rounded-full px-4 text-sm',
                    filter === f.id ? 'bg-brand font-semibold text-brand-accent' : 'border border-line font-medium hover:border-ink-faint',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {SHOP.instagramUrl && (
              <button type="button" onClick={() => openExternal(SHOP.instagramUrl!)} className="mr-auto text-[15px] font-semibold underline-offset-4 hover:underline">
                לכל העבודות באינסטגרם
              </button>
            )}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
            {photos.map((g) => (
              <GalleryTile key={g.id} item={g} className="aspect-square max-w-full rounded-2xl" />
            ))}
          </div>
          {photos.length === 0 && <p className="m-0 text-ink-soft">אין עדיין עבודות בקטגוריה הזו</p>}
        </section>

        {SHOP.course && <CourseLead details={SHOP.course.details} />}
      </main>

      <footer className="border-t border-line-soft">
        <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-4 px-8 py-6 text-sm text-ink-mute">
          <span>
            {SHOP.fullName} • {SHOP.address}
          </span>
        </div>
      </footer>
    </>
  );
}

/** Course lead: builds the WhatsApp message to the shop, prefilled from the signed-in customer. */
function CourseLead({ details }: { details: string }) {
  const session = useSession();
  const [name, setName] = useState(session?.name ?? '');
  const [phone, setPhone] = useState(formatPhone(session?.phone ?? ''));
  const [exp, setExp] = useState<(typeof EXPERIENCE)[number]>('אין בכלל');
  const [sent, setSent] = useState(false);
  const valid = name.trim().length >= 2 && isValidMobile(phone);
  const message = `היי, אני ${name.trim()} ואשמח לשמוע על קורס הספרות. ניסיון: ${exp}. טלפון: ${phone}`;

  return (
    <section id="course" aria-labelledby="h-course" className="flex flex-wrap items-center gap-8 rounded-[28px] bg-brand p-9 text-white">
      <div className="flex flex-[1_1_380px] flex-col gap-3">
        <span className="self-start rounded-full bg-brand-accent px-3 py-1 text-[13px] font-bold text-brand">קורס ספרות</span>
        <h2 id="h-course" className="m-0 text-[32px] font-bold leading-tight">
          {g('רוצה ללמוד לספר?', 'רוצה ללמוד לספר?', 'רוצים ללמוד לספר?')}
        </h2>
        <p className="m-0 text-base leading-relaxed text-line-strong">קורס מעשי בקבוצות קטנות, על כיסא אמיתי {SHOP.inPlace}. משאירים פרטים ונחזור אליך בוואטסאפ עם כל הפרטים.</p>
        <span className="text-[13px] text-line-strong">{details}</span>
      </div>
      <div className="flex flex-[1_1_420px] flex-col gap-2.5">
        {sent ? (
          <div role="status" className="flex items-center gap-3 rounded-2xl bg-white p-[18px] text-ink">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-open text-white">
              <MessageCircle size={18} />
            </span>
            <span className="flex-1 text-base font-semibold">ההודעה מוכנה בוואטסאפ, רק ללחוץ שלח.</span>
            <button type="button" onClick={() => setSent(false)} className="text-[13px] font-semibold underline">
              עריכה
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2.5">
              <label htmlFor="cname" className="sr-only">
                שם מלא
              </label>
              <input
                id="cname"
                autoComplete="name"
                placeholder="שם מלא"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-[52px] min-w-0 flex-[1_1_180px] rounded-[14px] bg-white px-4 text-ink outline-none"
              />
              <label htmlFor="cphone" className="sr-only">
                מספר נייד
              </label>
              <input
                id="cphone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                placeholder="05X-XXXXXXX"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                className="h-[52px] min-w-0 flex-[1_1_180px] rounded-[14px] bg-white px-4 text-right text-ink outline-none"
              />
            </div>
            <div className="flex gap-2" role="group" aria-label="ניסיון בספרות">
              {EXPERIENCE.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={exp === e}
                  onClick={() => setExp(e)}
                  className={cx(
                    'h-11 flex-1 rounded-xl text-sm',
                    exp === e ? 'bg-brand-accent font-semibold text-brand' : 'border border-white/25 font-medium hover:border-white/50',
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!valid}
              onClick={() => {
                openExternal(whatsappUrl(SHOP.phone, message));
                setSent(true);
              }}
              className="press h-[52px] rounded-[14px] bg-brand-accent text-base font-bold text-brand disabled:opacity-40"
            >
              {g('שלח פרטים בוואטסאפ', 'שלחי פרטים בוואטסאפ', 'שלחו פרטים בוואטסאפ')}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
