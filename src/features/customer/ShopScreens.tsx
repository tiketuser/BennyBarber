import { useMemo, useState } from 'react';
import { ChevronLeft, GraduationCap, Instagram, LogOut, Map, MessageCircle, Navigation, Phone, Pin, Scissors } from 'lucide-react';
import { useBackend, useDb, useNow, useSession } from '@/data/store';
import { hoursFor } from '@/domain/schedule';
import type { GalleryCategory, GalleryItem, Settings, Weekday } from '@/domain/types';
import { SHOP } from '@/config/shop';
import { telUrl, whatsappUrl } from '@/lib/links';
import { formatPhone, isValidMobile } from '@/lib/phone';
import { openExternal } from '@/lib/platform';
import { DAY_LETTERS, fmtRange, nowMinutes, todayKey, weekdayOf } from '@/lib/time';
import { Bubble, Button, Chip, Field, PhoneInput, ScreenHeader, TextInput, cx } from '@/ui/controls';
import { TAB_BAR_SPACE } from '@/ui/TabBar';

/** Groups consecutive weekdays with identical hours: "א׳ - ה׳ 09:00 - 20:00". */
export function groupHours(settings: Settings) {
  const rows: { days: Weekday[]; label: string; value: string; open: boolean }[] = [];
  for (let d = 0 as Weekday; d <= 6; d = (d + 1) as Weekday) {
    const h = settings.hours[d];
    const value = h.open ? fmtRange(h.from, h.to) : 'סגור';
    const last = rows[rows.length - 1];
    if (last && last.value === value && last.days[last.days.length - 1] === d - 1) last.days.push(d);
    else rows.push({ days: [d], label: '', value, open: h.open });
  }
  for (const r of rows) {
    const a = r.days[0];
    const b = r.days[r.days.length - 1];
    r.label = a === b ? (a === 6 ? 'שבת' : DAY_LETTERS[a]) : `${DAY_LETTERS[a]} - ${DAY_LETTERS[b]}`;
  }
  return rows;
}

export function GalleryTile({ item, className }: { item: GalleryItem; className?: string }) {
  return (
    <div className={cx('relative overflow-hidden bg-[#CFCBC5]', className)}>
      {item.src ? (
        <img src={item.src} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-[#44403C]">
          <Scissors size={22} aria-hidden />
        </div>
      )}
      {item.pinned && (
        <span role="img" aria-label="נעוץ" className="absolute right-[7px] top-[7px] flex text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
          <Pin size={14} strokeWidth={1.75} />
        </span>
      )}
    </div>
  );
}

/** Tab 3: gallery preview, hours, navigation/contact, course lead. */
export function ShopScreen({ onGallery, onCourse }: { onGallery: () => void; onCourse: () => void }) {
  const db = useDb();
  const backend = useBackend();
  const now = useNow();
  const today = todayKey(now);
  const wd = weekdayOf(today);
  const h = hoursFor(db.settings, today);
  const openNow = !!h && nowMinutes(now) >= h.from && nowMinutes(now) < h.to;
  const pinned = useMemo(() => [...db.gallery].filter((g) => g.pinned).sort((a, b) => a.order - b.order).slice(0, 4), [db.gallery]);

  const links = [
    { label: 'Waze', icon: <Navigation size={20} />, url: SHOP.wazeUrl, dark: true },
    { label: 'Google Maps', icon: <Map size={20} />, url: SHOP.mapsUrl },
    { label: 'התקשר', icon: <Phone size={20} />, url: telUrl(SHOP.phone) },
    { label: 'Instagram', icon: <Instagram size={20} />, url: SHOP.instagramUrl },
  ];

  return (
    <div className="absolute inset-0 overflow-y-auto pt-safe" style={{ paddingBottom: `calc(${TAB_BAR_SPACE} + 16px)` }}>
      <header className="flex flex-col gap-1 px-5 pb-3.5 pt-[22px]">
        <h1 className="m-0 font-brand text-[28px] font-normal leading-tight">{SHOP.fullName}</h1>
        <div className="text-sm text-ink-soft">{SHOP.address}</div>
      </header>

      <div className="flex items-center justify-between px-5 pb-2">
        <span className="text-sm font-semibold text-ink-soft">מהעבודות שלנו</span>
        <button type="button" onClick={onGallery} className="flex h-9 items-center gap-1 text-sm font-semibold">
          לכל הגלריה
          <ChevronLeft size={16} />
        </button>
      </div>
      <button type="button" onClick={onGallery} aria-label="פתח גלריה" className="press grid w-full grid-cols-2 gap-2 px-4">
        {pinned.map((g) => (
          <GalleryTile key={g.id} item={g} className="h-[100px] rounded-2xl" />
        ))}
      </button>

      <div className="mx-4 mt-4 rounded-[18px] border border-line px-4 py-1.5">
        {groupHours(db.settings).map((r, i, all) => {
          const isToday = r.days.includes(wd);
          return (
            <div key={r.label} className={cx('flex h-10 items-center justify-between text-[15px]', i < all.length - 1 && 'border-b border-line-soft', isToday && 'font-semibold', !r.open && 'text-ink-soft')}>
              <span className="flex items-center gap-2">
                {r.label}
                {isToday && (
                  <span className={cx('rounded-full px-2 py-[3px] text-[11px]', openNow ? 'bg-open-soft text-open-text' : 'bg-surface text-ink-soft')}>
                    היום • {openNow ? 'פתוח' : 'סגור'}
                  </span>
                )}
              </span>
              <span dir="ltr" className={cx('num', r.open && 'font-medium')}>
                {r.value}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mx-4 mt-4 grid grid-cols-2 gap-2">
        {links.map((l) => (
          <button
            key={l.label}
            type="button"
            onClick={() => openExternal(l.url)}
            className={cx('press flex h-[60px] items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold', l.dark ? 'bg-beitar-black text-white' : 'bg-surface text-ink')}
          >
            {l.icon}
            {l.label}
          </button>
        ))}
      </div>

      <button type="button" onClick={onCourse} className="press mx-4 mt-4 flex h-[72px] w-[calc(100%-32px)] items-center gap-3 rounded-[18px] bg-beitar-black pe-3.5 ps-4 text-right text-white">
        <span className="flex size-11 items-center justify-center rounded-full bg-beitar-yellow text-beitar-black">
          <GraduationCap size={22} />
        </span>
        <span className="flex flex-1 flex-col gap-[3px]">
          <span className="text-base font-semibold">רוצה ללמוד לספר?</span>
          <span className="text-[13px] text-line-strong">קורס ספרות גברים</span>
        </span>
        <ChevronLeft size={20} />
      </button>

      <button type="button" onClick={() => backend.auth.signOut()} className="mx-auto mt-6 flex h-11 items-center gap-2 px-4 text-sm font-medium text-ink-soft">
        <LogOut size={16} />
        התנתקות
      </button>
    </div>
  );
}

const FILTERS: { id: GalleryCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'הכל' },
  { id: 'haircut', label: 'תספורות' },
  { id: 'beard', label: 'זקן' },
  { id: 'kids', label: 'ילדים' },
];

export function GalleryScreen({ onBack }: { onBack: () => void }) {
  const db = useDb();
  const [filter, setFilter] = useState<GalleryCategory | 'all'>('all');
  const items = [...db.gallery]
    .filter((g) => filter === 'all' || g.category === filter)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order);
  return (
    <>
      <ScreenHeader
        title="גלריה"
        onBack={onBack}
        aside={
          <button type="button" onClick={() => openExternal(SHOP.instagramUrl)} aria-label="עוד עבודות באינסטגרם" className="press ml-2 flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] font-semibold">
            <Instagram size={16} />
            <span dir="ltr">@{SHOP.instagram}</span>
          </button>
        }
      />
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3 pt-2">
        {FILTERS.map((f) => (
          <Chip key={f.id} on={filter === f.id} onClick={() => setFilter(f.id)} className="h-10 shrink-0">
            {f.label}
          </Chip>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-[112px] grid-cols-3 gap-1 overflow-y-auto px-4 pb-bar-lg pt-1">
        {items.map((g) => (
          <GalleryTile key={g.id} item={g} className="rounded-lg" />
        ))}
      </div>
    </>
  );
}

const EXPERIENCE = ['אין בכלל', 'קצת', 'כבר עובד'] as const;

/** Course lead form: builds a WhatsApp message to the shop. */
export function CourseScreen({ onBack }: { onBack: () => void }) {
  const session = useSession();
  const [name, setName] = useState(session?.name ?? '');
  const [phone, setPhone] = useState(formatPhone(session?.phone ?? ''));
  const [exp, setExp] = useState<(typeof EXPERIENCE)[number]>('אין בכלל');
  const message = `היי, אני ${name.trim() || '[שם]'} ואשמח לשמוע על קורס הספרות. ניסיון: ${exp}. טלפון: ${phone || '05X-XXXXXXX'}`;
  const valid = name.trim().length >= 2 && isValidMobile(phone);

  return (
    <>
      <ScreenHeader onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <section className="mx-4 mt-1 flex flex-col gap-2 rounded-[22px] bg-beitar-black p-5 text-white">
          <span className="self-start rounded-full bg-beitar-yellow px-2.5 py-1 text-xs font-semibold text-beitar-black">קורס ספרות גברים</span>
          <h1 className="m-0 mt-1 font-brand text-[28px] font-normal leading-tight">ללמוד לספר</h1>
          <p className="m-0 text-[15px] leading-normal text-line-strong">משאירים פרטים ונחזור אליך עם כל המידע על הקורס.</p>
          <div className="mt-1 text-[13px] text-line-strong">{SHOP.course.details}</div>
        </section>
        <div className="flex flex-col gap-3.5 px-4 pt-5">
          <Field id="cname" label="שם מלא">
            <TextInput id="cname" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field id="ctel" label="מספר נייד">
            <PhoneInput id="ctel" value={phone} onChange={setPhone} />
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">ניסיון בספרות</span>
            <div className="flex gap-2">
              {EXPERIENCE.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={exp === e}
                  onClick={() => setExp(e)}
                  className={cx('press h-11 flex-1 rounded-xl text-sm', exp === e ? 'bg-beitar-black font-semibold text-white' : 'border border-line font-medium')}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-4 mt-[18px] flex flex-col gap-1.5">
          <span className="text-xs text-ink-soft">ההודעה שתישלח בוואטסאפ:</span>
          <Bubble className="max-w-[300px]">{message}</Bubble>
        </div>
      </div>
      <div className="glass border-t border-line-soft px-4 pt-3 pb-bar-lg">
        <Button block variant="whatsapp" disabled={!valid} icon={<MessageCircle size={20} />} onClick={() => openExternal(whatsappUrl(SHOP.phone, message))}>
          שלח בוואטסאפ
        </Button>
      </div>
    </>
  );
}
