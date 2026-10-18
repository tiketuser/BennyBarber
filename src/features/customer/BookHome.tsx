import { Check, ChevronLeft, MessageCircle, Navigation } from 'lucide-react';
import { useDb, useNow } from '@/data/store';
import { SHOP, g } from '@/config/shop';
import { whatsappUrl } from '@/lib/links';
import { openExternal } from '@/lib/platform';
import { DAY_LETTERS, fmtTime, fromKey, relativeDayLabel, todayKey, weekdayOf } from '@/lib/time';
import { Button } from '@/ui/controls';
import { cx } from '@/ui/cx';
import { TAB_BAR_SPACE } from '@/ui/TabBar';
import { customerPrice } from '../format';
import { useMyAppointments, useOpenStatus } from './hooks';
import { InstallBanner } from './InstallBanner';
import { ShopMark } from '@/ui/ShopMark';

interface Props {
  serviceId: string | null;
  onSelectService: (id: string) => void;
  onNext: () => void;
  onOpenMine: () => void;
}

/** Tab 1, step 1: header, next-appointment ticket, service picker. */
export function BookHome({ serviceId, onSelectService, onNext, onOpenMine }: Props) {
  const db = useDb();
  const now = useNow();
  const status = useOpenStatus();
  const { upcoming } = useMyAppointments();
  const next = upcoming[0];
  const services = [...db.services].sort((a, b) => a.order - b.order);

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pt-safe" style={{ paddingBottom: `calc(${TAB_BAR_SPACE} + 84px)` }}>
        <header className="flex items-center justify-between gap-3 px-5 pt-[18px]">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-brand-accent">
              <ShopMark size={20} />
            </div>
            <div className="flex min-w-0 flex-col gap-[3px]">
              <div className="font-brand text-2xl leading-none">{SHOP.brand}</div>
              <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs text-ink-soft">
                <span className={cx('size-[7px] shrink-0 rounded-full', status.open ? 'bg-open-dot' : 'bg-ink-faint')} />
                <span className={cx('font-medium', status.open ? 'text-open-text' : 'text-ink-soft')}>{status.text}</span>
                <span className="truncate">• {SHOP.address}</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              aria-label="ניווט ב-Waze"
              onClick={() => openExternal(SHOP.wazeUrl)}
              className="press flex size-11 items-center justify-center rounded-full border border-line bg-surface"
            >
              <Navigation size={18} />
            </button>
            <button
              type="button"
              aria-label={`וואטסאפ ${SHOP.toPlace}`}
              onClick={() => openExternal(whatsappUrl(SHOP.phone, 'היי, '))}
              className="press flex size-11 items-center justify-center rounded-full border border-open-line bg-open-soft text-open-text"
            >
              <MessageCircle size={18} />
            </button>
          </div>
        </header>

        <InstallBanner />

        {next && (
          <section aria-label="התור הקרוב שלך" className="mx-4 mt-[18px] flex items-center gap-3.5 rounded-[20px] border border-line bg-surface px-4 py-3.5">
            <div className="flex h-14 w-[52px] flex-col items-center justify-center rounded-[14px] bg-brand leading-tight text-brand-accent">
              <span className="text-[11px] font-medium">{relativeDayLabel(next.date, todayKey(now)) ?? `יום ${DAY_LETTERS[weekdayOf(next.date)]}`}</span>
              <span className="text-xl font-bold">{fromKey(next.date).getDate()}</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <div className="text-xs text-ink-soft">התור הקרוב שלך</div>
              <div className="truncate text-base font-semibold">
                {fmtTime(next.start)} • {next.serviceName}
              </div>
            </div>
            <button type="button" onClick={onOpenMine} className="press h-10 rounded-xl bg-surface-sunk px-3.5 text-sm font-medium">
              פרטים
            </button>
          </section>
        )}

        <div className="flex items-baseline justify-between px-5 pb-3 pt-6">
          <h1 className="m-0 text-2xl font-bold tracking-display">מה עושים היום?</h1>
          <span className="text-[13px] text-ink-soft">שלב 1 מתוך 3</span>
        </div>

        <div role="radiogroup" aria-label={g('בחר טיפול', 'בחרי טיפול', 'בחרו טיפול')} className="flex flex-col gap-2 px-4">
          {services.map((s) => {
            const on = s.id === serviceId;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onSelectService(s.id)}
                className={cx(
                  'press flex min-h-16 items-center gap-3 rounded-2xl px-4 text-right transition-colors duration-150',
                  on ? 'border-2 border-brand bg-white' : 'border border-line bg-surface',
                )}
              >
                {on && (
                  <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-brand text-brand-accent">
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
                <span className={cx('flex flex-1 flex-wrap items-center gap-2 py-3 text-base', on ? 'font-semibold' : 'font-medium')}>
                  {s.name}
                  {s.popular && <span className="rounded-full bg-brand-accent px-2 py-[3px] text-[11px] font-semibold text-brand">הכי מוזמן</span>}
                </span>
                <span className="text-[13px] text-ink-soft">{s.durationMin} דק׳</span>
                <span
                  className={cx('w-[52px] text-left', s.priceHidden ? 'text-xs font-medium leading-tight text-ink-soft' : on ? 'text-base font-bold' : 'text-base font-semibold')}
                >
                  {customerPrice(s)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass absolute inset-x-0 z-[5] px-4 py-3" style={{ bottom: TAB_BAR_SPACE }}>
        <Button block disabled={!serviceId} onClick={onNext}>
          בחירת יום ושעה
          <ChevronLeft size={20} />
        </Button>
      </div>
    </div>
  );
}
