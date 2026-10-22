import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Ban, CalendarPlus, Check, ChevronLeft, ChevronRight, Coffee, Hourglass, Timer, MessageCircle, Phone, Plus, StickyNote, UserX, X } from 'lucide-react';
import { useDb, useNow } from '@/data/store';
import { busyFor, freeGaps, hoursFor } from '@/domain/schedule';
import type { Appointment, Block, DateKey, Minutes } from '@/domain/types';
import { telUrl, whatsappUrl } from '@/lib/links';
import { openExternal } from '@/lib/platform';
import { addDays, fmtLongDate, fmtRange, fmtShortDate, fmtTime, greeting, nowMinutes, todayKey } from '@/lib/time';
import { cx } from '@/ui/cx';
import { TAB_BAR_SPACE } from '@/ui/TabBar';
import { spring } from '@/ui/motion';
import { firstName, money } from '../format';
import { AdminCancelSheet, BlockSheet, CalendarSheet, DelaySheet, DurationSheet, FreeSlotsSheet } from './DaySheets';
import { useReleaseBlock } from './useReleaseBlock';
import { useNoShow } from './useNoShow';
import { OpeningAlert } from './OpeningAlert';
import { WaitlistPanel } from './WaitlistPanel';
import { useOpenings } from './openings';
import { SHOP } from '@/config/shop';

type Row =
  | { kind: 'appointment'; from: Minutes; to: Minutes; appt: Appointment }
  | { kind: 'block'; from: Minutes; to: Minutes; block: Block }
  | { kind: 'break'; from: Minutes; to: Minutes }
  | { kind: 'slot'; from: Minutes; to: Minutes };

interface Props {
  date: DateKey;
  setDate: (d: DateKey) => void;
  onQuick: (start: Minutes | null) => void;
  /** Phone: one scrolling column. Desk: stats row, timeline beside the waitlist alert and free windows. */
  layout?: 'phone' | 'desk';
}

/** "יומן": summary tiles, waitlist alert, and the day's timeline with one-tap actions. */
/** Every time a walk-in can start in a free window: its start, then each half hour that still leaves 20 minutes. */
function slotStarts(from: Minutes, to: Minutes): Minutes[] {
  const out = [from];
  for (let t = Math.ceil((from + 1) / 30) * 30; t + 20 <= to; t += 30) out.push(t);
  return out;
}

export function DayView({ date, setDate, onQuick, layout = 'phone' }: Props) {
  const db = useDb();
  const now = useNow();
  const today = todayKey(now);
  const isToday = date === today;
  const nowM = nowMinutes(now);
  const [freeOpen, setFreeOpen] = useState(false);
  const [delayOpen, setDelayOpen] = useState(false);
  const [editBlock, setEditBlock] = useState<Block | null>(null);
  const [cancelAppt, setCancelAppt] = useState<Appointment | null>(null);
  const [durationAppt, setDurationAppt] = useState<Appointment | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const openings = useOpenings();
  const releaseBlock = useReleaseBlock();
  const noShow = useNoShow();
  const hours = hoursFor(db.settings, date);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = busyFor(db, date).map((b) =>
      b.kind === 'appointment'
        ? { kind: 'appointment', from: b.from, to: b.to, appt: b.ref as Appointment }
        : b.kind === 'block'
          ? { kind: 'block', from: b.from, to: b.to, block: b.ref as Block }
          : { kind: 'break', from: b.from, to: b.to },
    );
    // Calendar style: every time a client can start gets its own row.
    // From the day's opening, not from now, so a client who already came can still be written down.
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    for (const g of freeGaps(db, date, 20, dayStart)) {
      const starts = slotStarts(g.from, g.to);
      starts.forEach((t, i) => out.push({ kind: 'slot', from: t, to: starts[i + 1] ?? g.to }));
    }
    return out.sort((a, b) => a.from - b.from || (a.kind === 'slot' ? 1 : -1));
  }, [db, date, now]);

  const appts = rows.filter((r): r is Extract<Row, { kind: 'appointment' }> => r.kind === 'appointment');
  const revenue = appts.reduce((t, r) => t + r.appt.price, 0);
  const free = useMemo(() => freeGaps(db, date, 20, now), [db, date, now]);
  const hasUpcoming = isToday && appts.some((r) => r.to > nowM);
  // An empty or closed day offers a jump: to the next day with appointments, else the next day the shop is open.
  const next = useMemo(() => {
    if (appts.length) return null;
    const booked = new Set(db.appointments.filter((a) => a.status === 'booked' && a.date > date).map((a) => a.date));
    const soonest = [...booked].sort()[0];
    if (soonest) return { date: soonest, label: 'ליום הבא עם תורים' };
    for (let d = addDays(date, 1), i = 0; i < 60; d = addDays(d, 1), i++) if (hoursFor(db.settings, d)) return { date: d, label: 'ליום הבא' };
    return null;
  }, [appts.length, db, date]);

  const timeline = (
    <div className={cx('flex flex-col gap-2.5', layout === 'phone' && 'px-4 pt-[18px]')}>
      {(!hours || appts.length === 0) && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface p-6 text-center">
          <p className="text-ink-soft">{hours ? 'אין תורים ביום הזה' : `${SHOP.closed} ביום הזה`}</p>
          {next && (
            <button
              type="button"
              onClick={() => setDate(next.date)}
              className="press inline-flex h-11 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-brand-accent"
            >
              {next.label} · {fmtShortDate(next.date)}
              <ChevronLeft size={16} />
            </button>
          )}
        </div>
      )}
      <AnimatePresence initial={false}>
        {rows.map((r, i) => {
          const next = rows[i + 1];
          // Two appointments with no free row between them (back to back, or a gap under 20 minutes): a small "+" squeezes a client in.
          const squeezeAt = r.kind === 'appointment' && next?.kind === 'appointment' && !(date < today) && !(isToday && r.to <= nowM) ? r.to : null;
          const past = (isToday && r.to <= nowM) || date < today;
          const current = isToday && r.from <= nowM && nowM < r.to;
          const key = r.kind === 'appointment' ? r.appt.id : r.kind === 'block' ? r.block.id : `${r.kind}-${r.from}`;
          return (
            <motion.div
              key={key}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              transition={spring.ui}
              className={cx('flex gap-2.5', past && 'opacity-55')}
            >
              <div className="flex w-11 shrink-0 flex-col gap-1 pt-3.5">
                <span className={cx('num text-[13px]', current ? 'font-bold' : 'font-semibold text-ink-soft')}>{fmtTime(r.from)}</span>
                {current && <span className="text-[10px] font-semibold text-open-text">עכשיו</span>}
              </div>
              <div className="min-w-0 flex-1">
                {r.kind === 'appointment' &&
                  (past ? (
                    <div className="flex h-[52px] items-center gap-2 rounded-[14px] bg-surface px-3.5 text-sm">
                      <Check size={16} className="text-open" />
                      <span className="flex-1 truncate">
                        {r.appt.customerName} • {r.appt.serviceName}
                      </span>
                      <span className="font-semibold">{money(r.appt.price)}</span>
                      <button
                        type="button"
                        aria-label={`${r.appt.customerName} לא הגיע`}
                        onClick={() => noShow(r.appt)}
                        className="press -my-1 -ml-1.5 flex h-9 items-center gap-1 rounded-[10px] bg-danger-soft px-2.5 text-[13px] font-semibold text-danger"
                      >
                        <UserX size={15} />
                        לא הגיע
                      </button>
                    </div>
                  ) : (
                    <AppointmentCard
                      appt={r.appt}
                      today={today}
                      current={current}
                      onCancel={() => setCancelAppt(r.appt)}
                      onDuration={() => setDurationAppt(r.appt)}
                      onNoShow={() => noShow(r.appt)}
                    />
                  ))}
                {squeezeAt != null && (
                  <button
                    type="button"
                    aria-label={`דחוף לקוח ב-${fmtTime(squeezeAt)}`}
                    onClick={() => onQuick(squeezeAt)}
                    className="press mx-auto -mb-1 mt-1 flex h-7 items-center gap-1 rounded-full border border-dashed border-line-strong px-3 text-[12px] font-semibold text-ink-soft"
                  >
                    <Plus size={13} />
                    דחוף לקוח
                  </button>
                )}
                {r.kind === 'block' && (
                  <div className="flex h-[52px] items-center gap-2 rounded-[14px] bg-danger-soft px-3.5 text-sm font-medium text-danger">
                    <Ban size={16} />
                    <span className="min-w-0 flex-1 truncate">
                      {r.block.label ?? 'חסום'} • {fmtRange(r.from, r.to)}
                    </span>
                    {!past && (
                      <>
                        <button type="button" onClick={() => setEditBlock(r.block)} className="press h-9 rounded-[10px] bg-white px-2.5 text-[13px] font-semibold">
                          ערוך
                        </button>
                        <button type="button" onClick={() => releaseBlock(r.block)} className="press h-9 px-1 text-[13px] font-semibold underline">
                          שחרר
                        </button>
                      </>
                    )}
                  </div>
                )}
                {r.kind === 'break' && (
                  <div className="flex h-[52px] items-center gap-2 rounded-[14px] bg-danger-soft px-3.5 text-sm font-medium text-danger">
                    <Coffee size={16} />
                    <span className="flex-1">הפסקה • {fmtRange(r.from, r.to)}</span>
                  </div>
                )}
                {r.kind === 'slot' && (
                  <button
                    type="button"
                    aria-label={`הוסף לקוח ב-${fmtTime(r.from)}`}
                    onClick={() => onQuick(r.from)}
                    className="press flex h-[52px] w-full items-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-line-strong px-3.5 text-right text-sm text-ink-soft"
                  >
                    <span className="flex-1">פנוי</span>
                    <span className="flex items-center gap-1 font-semibold text-brand">
                      <Plus size={16} />
                      הוסף
                    </span>
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );

  const sheets = (
    <>
      <FreeSlotsSheet
        open={freeOpen}
        onClose={() => setFreeOpen(false)}
        date={date}
        onAdd={(start) => {
          setFreeOpen(false);
          onQuick(start);
        }}
      />
      <DelaySheet open={delayOpen} onClose={() => setDelayOpen(false)} />
      <BlockSheet block={editBlock} onClose={() => setEditBlock(null)} />
      <AdminCancelSheet appt={cancelAppt} onClose={() => setCancelAppt(null)} />
      <DurationSheet appt={durationAppt} onClose={() => setDurationAppt(null)} />
      <CalendarSheet open={calendarOpen} onClose={() => setCalendarOpen(false)} />
    </>
  );

  if (layout === 'desk') {
    const waiting = db.waitlist.filter((w) => w.date === date).length;
    const tiles = [
      { value: String(appts.length), label: isToday ? 'תורים היום' : 'תורים' },
      { value: money(revenue), label: date < today ? 'הכנסה' : 'צפי הכנסה' },
      { value: String(waiting), label: 'ברשימת המתנה' },
    ];
    return (
      <>
        <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="m-0 font-brand text-[32px] font-normal leading-tight">{isToday ? greeting(now) : date < today ? 'יומן עבר' : 'יומן'}</h1>
              <span className="text-[15px] text-ink-soft">
                {fmtLongDate(date)} • {hours ? `פתוח ${fmtRange(hours.from, hours.to)}` : 'סגור'}
              </span>
            </div>
            <div className="mr-auto flex gap-2.5">
              <div className="flex h-11 items-center rounded-xl border border-line">
                <button
                  type="button"
                  aria-label="יום קודם"
                  onClick={() => setDate(addDays(date, -1))}
                  className="flex size-11 items-center justify-center rounded-xl hover:bg-surface"
                >
                  <ChevronRight size={20} />
                </button>
                <button type="button" onClick={() => setDate(today)} disabled={isToday} className="px-1.5 text-sm font-semibold disabled:cursor-default">
                  היום
                </button>
                <button
                  type="button"
                  aria-label="יום הבא"
                  onClick={() => setDate(addDays(date, 1))}
                  className="flex size-11 items-center justify-center rounded-xl hover:bg-surface"
                >
                  <ChevronLeft size={20} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setCalendarOpen(true)}
                className="press flex h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold hover:border-ink-faint"
              >
                <CalendarPlus size={18} />
                כל התורים ליומן
              </button>
              {hasUpcoming && (
                <button
                  type="button"
                  onClick={() => setDelayOpen(true)}
                  className="press flex h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold hover:border-ink-faint"
                >
                  <Hourglass size={18} />
                  מתעכב
                </button>
              )}
              {hours && (
                <button
                  type="button"
                  onClick={() => onQuick(null)}
                  className="press flex h-11 items-center gap-2 rounded-xl bg-brand px-[18px] text-sm font-semibold text-brand-accent"
                >
                  <Plus size={18} />
                  תור חדש
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
            {tiles.slice(0, 2).map((t) => (
              <div key={t.label} className="flex flex-col gap-1.5 rounded-[18px] bg-surface p-[18px]">
                <span className="num text-[30px] font-bold leading-none">{t.value}</span>
                <span className="text-sm text-ink-soft">{t.label}</span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setFreeOpen(true)}
              className="press flex flex-col gap-1.5 rounded-[18px] border border-open-line bg-open-soft p-[18px] text-right text-open-text"
            >
              <span className="num text-[30px] font-bold leading-none">{free.length}</span>
              <span className="text-sm font-semibold">חלונות פנויים ←</span>
            </button>
            <div className="flex flex-col gap-1.5 rounded-[18px] bg-surface p-[18px]">
              <span className="num text-[30px] font-bold leading-none">{tiles[2].value}</span>
              <span className="text-sm text-ink-soft">{tiles[2].label}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-6">
            <section aria-labelledby="h-day" className="flex min-w-0 flex-[1_1_520px] flex-col gap-2.5">
              <h2 id="h-day" className="m-0 mb-1 text-lg font-bold">
                {isToday ? 'היומן של היום' : 'היומן'}
              </h2>
              {timeline}
            </section>
            <div className="sticky top-7 flex min-w-[280px] flex-[0_1_340px] flex-col gap-4">
              <AnimatePresence initial={false}>{openings[0] && <OpeningAlert key={openings[0].id} appt={openings[0]} className="" />}</AnimatePresence>
              <WaitlistPanel date={date} today={today} setDate={setDate} className="" />
              <section aria-labelledby="h-free" className="flex flex-col gap-2.5 rounded-[20px] border border-line p-[18px]">
                <h2 id="h-free" className="m-0 text-base font-bold">
                  {isToday ? 'חלונות פנויים היום' : 'חלונות פנויים'}
                </h2>
                {free.length === 0 && <span className="text-sm text-ink-soft">{hours ? 'אין חלונות פנויים' : `${SHOP.closed} ביום הזה`}</span>}
                {free.map((g) => (
                  <div key={g.from} className="flex h-12 items-center gap-2 rounded-xl bg-open-soft pe-1.5 ps-3 text-open-text">
                    <span className="num flex-1 text-sm font-semibold">{fmtRange(g.from, g.to)}</span>
                    <button type="button" onClick={() => onQuick(g.from)} className="press h-9 rounded-[10px] bg-white px-3 text-[13px] font-semibold">
                      הוסף
                    </button>
                  </div>
                ))}
                {free.length > 0 && (
                  <button type="button" onClick={() => setFreeOpen(true)} className="mt-0.5 self-start text-sm font-semibold underline-offset-4 hover:underline">
                    שתף בסטטוס וואטסאפ
                  </button>
                )}
              </section>
            </div>
          </div>
        </div>
        {sheets}
      </>
    );
  }

  return (
    <>
      <div className="absolute inset-0 overflow-y-auto pt-safe" style={{ paddingBottom: `calc(${TAB_BAR_SPACE} + 88px)` }}>
        <header className="flex items-center justify-between px-5 pt-5">
          <div className="flex flex-col gap-0.5">
            <h1 className="m-0 font-brand text-[22px] font-normal leading-tight">{isToday ? greeting(now) : date < today ? 'יומן עבר' : 'יומן'}</h1>
            <span className="text-sm text-ink-soft">{fmtLongDate(date)}</span>
          </div>
          <div className="flex items-center gap-1">
            {hasUpcoming && (
              <button
                type="button"
                onClick={() => setDelayOpen(true)}
                className="press ml-1 flex h-11 items-center gap-1.5 rounded-full bg-danger-warm px-3 text-sm font-semibold text-danger"
              >
                <Hourglass size={16} />
                מתעכב
              </button>
            )}
            <button
              type="button"
              aria-label="כל התורים ליומן"
              onClick={() => setCalendarOpen(true)}
              className="press flex size-11 items-center justify-center rounded-full bg-surface"
            >
              <CalendarPlus size={20} />
            </button>
            <button
              type="button"
              aria-label="יום קודם"
              onClick={() => setDate(addDays(date, -1))}
              className="press flex size-11 items-center justify-center rounded-full bg-surface"
            >
              <ChevronRight size={20} />
            </button>
            <button type="button" aria-label="יום הבא" onClick={() => setDate(addDays(date, 1))} className="press flex size-11 items-center justify-center rounded-full bg-surface">
              <ChevronLeft size={20} />
            </button>
          </div>
        </header>
        {!isToday && (
          <button type="button" onClick={() => setDate(today)} className="mx-5 mt-1 h-8 text-[13px] font-semibold underline">
            חזרה להיום
          </button>
        )}

        <div className="mx-4 mt-4 grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-0.5 rounded-2xl bg-brand p-3 text-white">
            <span className="num text-[22px] font-bold text-brand-accent">{appts.length}</span>
            <span className="text-xs text-line-strong">{isToday ? 'תורים היום' : 'תורים'}</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-2xl bg-surface p-3">
            <span className="num text-[22px] font-bold">{money(revenue)}</span>
            <span className="text-xs text-ink-soft">{date < today ? 'הכנסה' : 'צפי הכנסה'}</span>
          </div>
          <button type="button" onClick={() => setFreeOpen(true)} className="press relative flex flex-col gap-0.5 rounded-2xl border border-open-line bg-open-soft p-3 text-right">
            <span className="num text-[22px] font-bold text-open-text">{free.length}</span>
            <span className="text-xs font-medium text-open-text">חלונות פנויים</span>
            <ChevronLeft size={16} className="absolute left-2 top-3 text-open-text" />
          </button>
        </div>

        <AnimatePresence initial={false}>{openings[0] && <OpeningAlert key={openings[0].id} appt={openings[0]} />}</AnimatePresence>
        <WaitlistPanel date={date} today={today} setDate={setDate} />

        {timeline}
      </div>

      {hours && (
        <button
          type="button"
          aria-label="תור מהיר או חסימה"
          onClick={() => onQuick(null)}
          className="press absolute left-5 z-[5] flex size-[60px] items-center justify-center rounded-full bg-brand text-brand-accent shadow-[0_8px_24px_rgba(17,17,17,0.28)]"
          style={{ bottom: `calc(${TAB_BAR_SPACE} + 20px)` }}
        >
          <Plus size={28} />
        </button>
      )}

      {sheets}
    </>
  );
}

function AppointmentCard({
  appt,
  today,
  current,
  onCancel,
  onDuration,
  onNoShow,
}: {
  appt: Appointment;
  today: DateKey;
  current: boolean;
  onCancel: () => void;
  onDuration: () => void;
  onNoShow: () => void;
}) {
  const reminder = `היי ${firstName(appt.customerName)}, תזכורת לתור שלך ${appt.date === today ? 'היום' : `ב${fmtShortDate(appt.date)}`} ב-${fmtTime(appt.start)} ${SHOP.inPlace}. נתראה!`;
  return (
    <div className={cx('flex flex-col gap-2.5 rounded-2xl px-3.5 py-3', current ? 'border-2 border-brand' : 'border border-line')}>
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="truncate text-base font-semibold">
            {appt.customerName}
            {appt.source === 'walkin' && <span className="mr-1.5 rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-soft">נכנס מהרחוב</span>}
            {appt.delayMin ? <span className="mr-1.5 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">מתעכב {appt.delayMin} דק׳</span> : null}
          </span>
          <span className="flex items-center gap-1 text-[13px] text-ink-soft">
            {appt.serviceName} • {fmtRange(appt.start, appt.end)}
            <button type="button" aria-label="שינוי משך התור" onClick={onDuration} className="press -my-2 flex size-8 items-center justify-center rounded-full text-ink-soft">
              <Timer size={15} />
            </button>
          </span>
          {appt.notes && (
            <span className="mt-0.5 flex items-center gap-1 text-[13px] text-ink">
              <StickyNote size={14} className="shrink-0 text-ink-soft" />
              {appt.notes}
            </span>
          )}
        </div>
        <span className="num text-base font-bold">{money(appt.price)}</span>
      </div>
      <div className="flex gap-1.5">
        {appt.phone ? (
          <>
            <button
              type="button"
              onClick={() => openExternal(whatsappUrl(appt.phone, current ? '' : reminder))}
              className="press flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-open-soft text-sm font-semibold text-open-text"
            >
              <MessageCircle size={18} />
              {current ? 'וואטסאפ' : 'תזכורת'}
            </button>
            <button
              type="button"
              aria-label={`התקשר ל${appt.customerName}`}
              onClick={() => openExternal(telUrl(appt.phone))}
              className="press flex h-11 w-[52px] items-center justify-center rounded-xl bg-surface"
            >
              <Phone size={18} />
            </button>
          </>
        ) : (
          <span className="flex h-11 flex-1 items-center text-[13px] text-ink-soft">בלי מספר טלפון</span>
        )}
        {current && (
          <button type="button" onClick={onNoShow} className="press flex h-11 items-center gap-1 rounded-xl bg-danger-soft px-3 text-sm font-semibold text-danger">
            <UserX size={17} />
            לא הגיע
          </button>
        )}
        <button type="button" aria-label="ביטול תור" onClick={onCancel} className="press flex h-11 w-[52px] items-center justify-center rounded-xl bg-danger-soft text-danger">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
