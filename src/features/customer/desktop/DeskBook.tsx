import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, CalendarCheck, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useBackend, useDb, useNow, useSession } from '@/data/store';
import { PARTS, bookingDays, dayStatus, slotsFor } from '@/domain/schedule';
import type { Appointment, DateKey, Minutes } from '@/domain/types';
import { BOOKING_MONTHS, SHOP, g } from '@/config/shop';
import { formatPhone } from '@/lib/phone';
import { addToCalendar, haptic } from '@/lib/platform';
import { DAY_LETTERS, fmtShortDate, fmtTime, fromKey, MONTHS, todayKey, weekdayOf } from '@/lib/time';
import { Button } from '@/ui/controls';
import { cx } from '@/ui/cx';
import { spring } from '@/ui/motion';
import { useToast } from '@/ui/useToast';
import { customerPrice } from '../../format';
import { useWaitlist } from '../useWaitlist';
import { WaitlistCard, WaitlistOffer } from '../WaitlistCard';
import { VacationNote } from '../VacationNote';

/** Days shown at once: two weeks, with arrows to the next ones. */
const PAGE = 14;

interface Props {
  initialServiceId?: string;
  /** Set when moving an existing appointment to a new time. */
  replacing?: Appointment;
  onCancelReplace: () => void;
  onOpenMine: () => void;
}

/** Booking on one page: service, day and time on the right, the "כמעט סיימנו" summary on the left. */
export function DeskBook({ initialServiceId, replacing, onCancelReplace, onOpenMine }: Props) {
  const db = useDb();
  const now = useNow();
  const backend = useBackend();
  const session = useSession();
  const toast = useToast();
  const today = todayKey(now);

  const services = useMemo(() => [...db.services].sort((a, b) => a.order - b.order), [db.services]);
  const [serviceId, setServiceId] = useState(() => initialServiceId ?? services.find((s) => s.popular)?.id ?? services[0]?.id);
  const service = services.find((s) => s.id === serviceId) ?? services[0];
  const duration = service?.durationMin ?? 30;

  const days = useMemo(
    () =>
      bookingDays(today, BOOKING_MONTHS).map((date) => {
        const status = dayStatus(db, date, duration, now);
        const free = status === 'open' || status === 'almost-full' ? slotsFor(db, date, duration, now).filter((s) => s.available).length : 0;
        return { date, status, free };
      }),
    [db, today, duration, now],
  );

  const [pickedDate, setPickedDate] = useState<DateKey | null>(null);
  const firstBookable = days.find((d) => d.free > 0) ?? days.find((d) => d.status === 'full');
  const date = days.find((d) => d.date === pickedDate) ? pickedDate! : (firstBookable?.date ?? today);
  const day = days.find((d) => d.date === date)!;
  const pages = Math.ceil(days.length / PAGE);
  const [pageOverride, setPage] = useState<number | null>(null);
  const page = pageOverride ?? Math.floor(days.findIndex((d) => d.date === date) / PAGE);
  const shown = days.slice(page * PAGE, page * PAGE + PAGE);
  const monthsShown = [...new Set(shown.map((d) => MONTHS[fromKey(d.date).getMonth()]))].join(' - ');
  const slots = useMemo(() => slotsFor(db, date, duration, now), [db, date, duration, now]);

  const [pickedStart, setPickedStart] = useState<Minutes | null>(null);
  const [booked, setBooked] = useState<Appointment | null>(null);
  // A picked time stays only while it is still free (someone else may grab it meanwhile).
  const start = !booked && slots.some((s) => s.start === pickedStart && s.available) ? pickedStart : null;
  const [notes, setNotes] = useState(replacing?.notes ?? '');
  // Only while the old appointment is still booked: once moved (or cancelled) this page books a new one.
  const moving = replacing && db.appointments.some((a) => a.id === replacing.id && a.status === 'booked') ? replacing : undefined;
  const [busy, setBusy] = useState(false);
  const waitlist = useWaitlist(date);
  const isFull = day.status === 'full';

  const book = async () => {
    if (!service || start == null || !session || busy) return;
    setBusy(true);
    try {
      const appt = await backend.appointments.book({
        serviceId: service.id,
        date,
        start,
        customerName: session.name ?? '',
        phone: session.phone,
        notes,
        replacesId: moving?.id,
      });
      haptic('success');
      setBooked(appt);
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setBooked(null);
    setPickedStart(null);
    setNotes('');
    if (replacing) onCancelReplace();
  };

  return (
    <main className="mx-auto flex max-w-[1240px] flex-wrap items-start gap-8 px-8 pb-16 pt-9">
      <div className="flex min-w-0 flex-[1_1_640px] flex-col gap-9">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[34px] font-bold tracking-display">{moving ? 'שינוי מועד' : 'קביעת תור'}</h1>
          <p className="m-0 text-base text-ink-soft">{SHOP.address} • בוחרים טיפול, יום ושעה, וזהו.</p>
        </div>

        {moving && !booked && (
          <div className="-mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-[15px]">
            <span className="flex-1">
              מזיזים את התור של <b>{fmtShortDate(moving.date)}</b> ב-<b className="num">{fmtTime(moving.start)}</b>. התור הישן יתפנה רק אחרי {g('שתבחר', 'שתבחרי', 'שתבחרו')} מועד
              חדש.
            </span>
            <button type="button" onClick={onCancelReplace} className="flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-ink-soft hover:text-ink">
              <X size={16} />
              ביטול
            </button>
          </div>
        )}

        <section aria-labelledby="h-svc" className="flex flex-col gap-3.5">
          <StepTitle id="h-svc" n={1}>
            מה עושים?
          </StepTitle>
          <div role="radiogroup" aria-labelledby="h-svc" className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
            {services.map((s) => {
              const on = s.id === service?.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setServiceId(s.id);
                    setBooked(null);
                  }}
                  className={cx(
                    'press relative flex min-h-28 flex-col gap-1.5 rounded-[18px] bg-white p-4 text-right',
                    on ? 'border-2 border-brand' : 'border border-line hover:border-ink-faint',
                  )}
                >
                  <span className="text-base font-semibold">{s.name}</span>
                  <span className="text-[13px] text-ink-mute">{s.durationMin} דק׳</span>
                  <span className={cx('mt-auto', s.priceHidden ? 'text-sm font-medium text-ink-soft' : 'text-[17px] font-bold')}>{customerPrice(s)}</span>
                  {s.popular && <span className="absolute left-3.5 top-3.5 rounded-full bg-brand-accent px-2 py-[3px] text-[11px] font-bold text-brand">הכי מוזמן</span>}
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="h-day" className="flex flex-col gap-3.5">
          <StepTitle id="h-day" n={2}>
            מתי נוח לך?
          </StepTitle>
          <VacationNote className="" />
          <div className="flex items-center gap-2">
            <span className="flex-1 text-[15px] font-semibold">{monthsShown}</span>
            <button
              type="button"
              aria-label="הימים הקודמים"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="press flex size-9 items-center justify-center rounded-full border border-line disabled:opacity-35"
            >
              <ChevronRight size={18} />
            </button>
            <button
              type="button"
              aria-label="הימים הבאים"
              disabled={page >= pages - 1}
              onClick={() => setPage(page + 1)}
              className="press flex size-9 items-center justify-center rounded-full border border-line disabled:opacity-35"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
          <div role="radiogroup" aria-label={g('בחר יום', 'בחרי יום', 'בחרו יום')} className="grid grid-cols-7 gap-2">
            {shown.map((d) => {
              const on = d.date === date;
              const closed = d.status === 'closed' || d.status === 'vacation';
              const sub =
                d.date === today && !closed && d.status !== 'full'
                  ? 'היום'
                  : closed
                    ? d.status === 'vacation'
                      ? 'חופש'
                      : 'סגור'
                    : d.status === 'full'
                      ? 'מלא'
                      : `${d.free} פנויים`;
              return (
                <button
                  key={d.date}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={closed}
                  aria-label={`${fmtShortDate(d.date)} ${sub}`}
                  onClick={() => {
                    setPickedDate(d.date);
                    setPickedStart(null);
                    setBooked(null);
                  }}
                  className={cx(
                    'press flex h-[84px] flex-col items-center justify-center gap-1 rounded-2xl transition-colors',
                    on ? 'bg-brand text-white' : closed ? 'border border-dashed border-line text-ink-faint' : 'border border-line hover:border-ink-faint',
                  )}
                >
                  <span className="text-[13px] font-medium">{weekdayOf(d.date) === 6 ? 'שבת' : DAY_LETTERS[weekdayOf(d.date)]}</span>
                  <span className="text-2xl font-bold leading-none">{fromKey(d.date).getDate()}</span>
                  <span className={cx('text-[11px]', on ? 'font-semibold text-brand-accent' : d.status === 'full' ? 'text-danger' : 'text-ink-mute')}>{sub}</span>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`${date}-${isFull}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
              {isFull ? (
                <div className="flex flex-col gap-3">
                  <WaitlistCard date={date} waitlist={waitlist} className="" />
                  {!waitlist.mine && (
                    <Button disabled={waitlist.joining} onClick={waitlist.join} icon={<Bell size={20} />}>
                      היום מלא? {g('היכנס', 'היכנסי', 'היכנסו')} לרשימת המתנה
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-[18px] rounded-[20px] bg-surface p-5">
                  {PARTS.map((p) => {
                    const list = slots.filter((s) => s.start >= p.from && s.start < p.to);
                    if (!list.length) return null;
                    return (
                      <div key={p.id} className="flex flex-col gap-2.5">
                        <span className="text-[13px] font-semibold text-ink-soft">{p.label}</span>
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
                          {list.map((s) => {
                            const on = s.start === start;
                            return (
                              <button
                                key={s.start}
                                type="button"
                                disabled={!s.available}
                                aria-pressed={on}
                                aria-label={s.available ? undefined : `${fmtTime(s.start)} תפוס`}
                                onClick={() => {
                                  setPickedStart(s.start);
                                  setBooked(null);
                                }}
                                className={cx(
                                  'press num h-[46px] rounded-xl text-[15px] font-semibold',
                                  on
                                    ? 'border-2 border-brand bg-brand text-brand-accent'
                                    : s.available
                                      ? 'border border-line bg-white hover:border-brand'
                                      : 'cursor-default text-ink-faint line-through',
                                )}
                              >
                                {fmtTime(s.start)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {slots.length === 0 && <p className="m-0 py-4 text-center text-ink-soft">אין שעות פנויות ביום הזה</p>}
                  {date && <WaitlistOffer date={date} waitlist={waitlist} />}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>

      <aside
        aria-labelledby="h-sum"
        className="sticky top-[100px] flex min-w-[300px] flex-[0_1_380px] flex-col gap-[18px] rounded-3xl border border-line p-6 shadow-[0_12px_32px_rgba(28,25,23,0.06)]"
      >
        <StepTitle id="h-sum" n={3}>
          כמעט סיימנו
        </StepTitle>
        <dl className="m-0 flex flex-col rounded-2xl bg-surface">
          {[
            ['טיפול', service ? service.name + (service.priceHidden ? '' : ` • ${customerPrice(service)}`) : '-'],
            [
              'מתי',
              start != null
                ? `${fmtShortDate(date)} • ${fmtTime(start)}`
                : booked
                  ? `${fmtShortDate(booked.date)} • ${fmtTime(booked.start)}`
                  : g('בחר שעה', 'בחרי שעה', 'בחרו שעה'),
            ],
            ['על שם', `${session?.name ?? ''} • ${formatPhone(session?.phone ?? '')}`],
          ].map(([k, v], i) => (
            <div key={k} className={cx('flex justify-between gap-3 px-4 py-3.5', i < 2 && 'border-b border-line')}>
              <dt className="text-sm text-ink-soft">{k}</dt>
              <dd className="m-0 text-left text-[15px] font-semibold">{k === 'על שם' ? <bdi>{v}</bdi> : v}</dd>
            </div>
          ))}
        </dl>
        <label htmlFor="dnotes" className="text-sm font-semibold">
          {g('הערות לתספורת', 'הערות לטיפול', 'הערות לטיפול')} <span className="font-normal text-ink-mute">(לא חובה)</span>
        </label>
        <textarea
          id="dnotes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={g('למשל: קצר בצדדים, בלי מכונה למעלה', 'למשל: רק קצוות, גוון כמו בפעם הקודמת', 'למשל: כמו בפעם הקודמת')}
          className="-mt-2.5 resize-none rounded-[14px] border border-line px-3.5 py-3 text-[15px] outline-none focus:border-brand"
        />
        <AnimatePresence mode="wait" initial={false}>
          {booked ? (
            <motion.div
              key="done"
              role="status"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={spring.ui}
              className="flex flex-col gap-3 rounded-2xl border border-open-line bg-open-soft p-4 text-open-text"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-open text-white">
                  <Check size={20} strokeWidth={2.5} />
                </span>
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-base font-bold">{replacing ? 'התור הועבר!' : 'התור נקבע!'}</span>
                  <span className="text-[13px]">
                    {fmtShortDate(booked.date)} ב-{fmtTime(booked.start)}. נתראה {SHOP.inPlace}!
                  </span>
                </div>
              </div>
              <div className="flex gap-4 text-[13px] font-semibold">
                <button
                  type="button"
                  className="flex items-center gap-1 underline"
                  onClick={() =>
                    addToCalendar({
                      title: `${booked.serviceName} - ${SHOP.fullName}`,
                      date: booked.date,
                      start: booked.start,
                      end: booked.end,
                      location: SHOP.address,
                      notes: booked.notes,
                    })
                  }
                >
                  <CalendarCheck size={15} />
                  {g('הוסף ליומן', 'הוסיפי ליומן', 'הוסיפו ליומן')}
                </button>
                <button type="button" className="underline" onClick={onOpenMine}>
                  התורים שלי
                </button>
                <button type="button" className="underline" onClick={reset}>
                  עוד תור
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Button block disabled={start == null || busy} onClick={book}>
                {start == null
                  ? g('בחר שעה כדי להמשיך', 'בחרי שעה כדי להמשיך', 'בחרו שעה כדי להמשיך')
                  : `${moving ? g('העבר את התור ל-', 'העבירי את התור ל-', 'העבירו את התור ל-') : g('קבע תור ל-', 'קבעי תור ל-', 'קבעו תור ל-')}${fmtTime(start)}`}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <p className="m-0 text-[13px] leading-normal text-ink-mute">התשלום {SHOP.inPlace}. אפשר לבטל או להזיז את התור מ"התורים שלי".</p>
      </aside>
    </main>
  );
}

function StepTitle({ id, n, children }: { id: string; n: number; children: string }) {
  return (
    <h2 id={id} className="m-0 flex items-center gap-2.5 text-[19px] font-bold">
      <span className="flex size-7 items-center justify-center rounded-full bg-brand text-sm text-brand-accent">{n}</span>
      {children}
    </h2>
  );
}
