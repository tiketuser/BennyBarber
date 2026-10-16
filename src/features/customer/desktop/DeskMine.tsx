import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Bell, CalendarCheck, CalendarDays, MapPin, MessageCircle, Navigation, Repeat, RotateCcw, X } from 'lucide-react';
import { useBackend, useDb, useNow, useSession } from '@/data/store';
import { PART_LABELS } from '@/domain/schedule';
import type { Appointment } from '@/domain/types';
import { SHOP } from '@/config/shop';
import { formatPhone } from '@/lib/phone';
import { addToCalendar, haptic, openExternal } from '@/lib/platform';
import { DAY_LETTERS, MONTHS, MONTHS_SHORT, fmtDayShortMonth, fmtShortDate, fmtTime, fromKey, todayKey, weekdayOf } from '@/lib/time';
import { cx } from '@/ui/cx';
import { spring } from '@/ui/motion';
import { useToast } from '@/ui/useToast';
import { appointmentPrice } from '../../format';
import { useMyAppointments } from '../hooks';

interface Props {
  onReschedule: (a: Appointment) => void;
  onBookAgain: (serviceId: string) => void;
  onBookNew: () => void;
}

const DAY_MS = 86400000;

/** "התורים שלי" for desktop: the next appointment large, cancel confirmed in place with undo, past visits beside. */
export function DeskMine({ onReschedule, onBookAgain, onBookNew }: Props) {
  const backend = useBackend();
  const db = useDb();
  const now = useNow();
  const session = useSession();
  const toast = useToast();
  const { upcoming, past, waitlist } = useMyAppointments();
  const [confirming, setConfirming] = useState<string | null>(null);
  // Cancelled in this visit: they stay on screen with "ביטלתי בטעות" instead of vanishing.
  const [cancelled, setCancelled] = useState<Appointment[]>([]);

  const shown = [...upcoming, ...cancelled.filter((c) => !upcoming.some((u) => u.id === c.id))].sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1));
  const [hero, ...more] = shown;

  const cancel = async (a: Appointment) => {
    setConfirming(null);
    try {
      await backend.appointments.cancel(a.id);
      haptic();
      setCancelled((c) => [...c, a]);
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    }
  };
  const undo = async (a: Appointment) => {
    try {
      await backend.appointments.book({ serviceId: a.serviceId, date: a.date, start: a.start, customerName: a.customerName, phone: a.phone, notes: a.notes });
      haptic('success');
      setCancelled((c) => c.filter((x) => x.id !== a.id));
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    }
  };
  const isCancelled = (a: Appointment) => cancelled.some((c) => c.id === a.id) && !upcoming.some((u) => u.id === a.id);
  const priceOf = (a: Appointment) => (db.services.find((s) => s.id === a.serviceId)?.priceHidden ? null : appointmentPrice(a, db.services));

  // "בדרך כלל כל 3 שבועות", from the gaps between past visits.
  const visits = past.map((a) => fromKey(a.date).getTime());
  const weeks = visits.length >= 2 ? Math.round((visits[0] - visits[visits.length - 1]) / (visits.length - 1) / DAY_MS / 7) : null;

  return (
    <main className="mx-auto flex max-w-[1240px] flex-col gap-8 px-8 pb-16 pt-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[34px] font-bold tracking-display">התורים שלי</h1>
          <p className="m-0 text-base text-ink-soft">
            {session?.name} • <bdi dir="ltr">{formatPhone(session?.phone ?? '')}</bdi>
          </p>
        </div>
        <button type="button" onClick={onBookNew} className="press flex h-12 items-center gap-2 rounded-[14px] bg-brand px-5 text-[15px] font-semibold text-brand-accent">
          <CalendarDays size={18} />
          קבע תור חדש
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-[1_1_640px] flex-col gap-8">
          <section aria-labelledby="h-next" className="flex flex-col gap-3.5">
            <h2 id="h-next" className="m-0 text-[19px] font-bold">
              הבא בתור
            </h2>
            {hero ? (
              <HeroCard
                appt={hero}
                price={priceOf(hero)}
                daysAway={Math.round((fromKey(hero.date).getTime() - fromKey(todayKey(now)).getTime()) / DAY_MS)}
                state={isCancelled(hero) ? 'cancelled' : confirming === hero.id ? 'confirm' : 'active'}
                onAsk={() => setConfirming(hero.id)}
                onKeep={() => setConfirming(null)}
                onCancel={() => cancel(hero)}
                onUndo={() => undo(hero)}
                onReschedule={() => onReschedule(hero)}
                onBookNew={onBookNew}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-[28px] bg-surface px-6 py-12 text-center">
                <CalendarDays size={32} className="text-ink-soft" />
                <span className="text-lg font-semibold">אין לך תורים קרובים</span>
                <button type="button" onClick={onBookNew} className="press h-12 rounded-[14px] bg-brand px-5 text-[15px] font-semibold text-brand-accent">
                  לקביעת תור
                </button>
              </div>
            )}
            {hero && <p className="m-0 text-[13px] text-ink-mute">אפשר לבטל או להזיז את התור מכאן בכל זמן.</p>}
          </section>

          {more.length > 0 && (
            <section aria-labelledby="h-more" className="flex flex-col gap-3.5">
              <h2 id="h-more" className="m-0 text-[19px] font-bold">
                עוד תורים קרובים
              </h2>
              <div className="flex flex-col gap-2.5">
                {more.map((a) => {
                  const state = isCancelled(a) ? 'cancelled' : confirming === a.id ? 'confirm' : 'active';
                  return (
                    <div
                      key={a.id}
                      className={cx(
                        'overflow-hidden rounded-[20px]',
                        state === 'confirm' ? 'border-2 border-danger' : state === 'cancelled' ? 'border border-dashed border-line-strong' : 'border border-line',
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-[18px] px-5 py-4">
                        <DateTile appt={a} small dim={state === 'cancelled'} />
                        <div className={cx('flex min-w-0 flex-1 flex-col gap-1', state === 'cancelled' && 'text-ink-faint line-through')}>
                          <span className="text-base font-semibold">
                            {fmtShortDate(a.date)} • {fmtTime(a.start)}
                          </span>
                          <span className="text-sm text-ink-soft">
                            {a.serviceName} • {a.end - a.start} דק׳{priceOf(a) ? ` • ${priceOf(a)}` : ''}
                          </span>
                        </div>
                        {state === 'active' && (
                          <div className="flex gap-2">
                            <ActionButton onClick={() => onReschedule(a)} icon={<RotateCcw size={16} />}>
                              שינוי מועד
                            </ActionButton>
                            <ActionButton danger onClick={() => setConfirming(a.id)} icon={<X size={16} />}>
                              ביטול
                            </ActionButton>
                          </div>
                        )}
                        {state === 'cancelled' && (
                          <div className="flex items-center gap-3">
                            <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink-soft">בוטל</span>
                            <button type="button" onClick={() => undo(a)} className="text-sm font-semibold text-ink-soft underline">
                              ביטלתי בטעות
                            </button>
                          </div>
                        )}
                      </div>
                      {state === 'confirm' && (
                        <div role="alertdialog" aria-label="אישור ביטול" className="flex flex-wrap items-center gap-3 border-t border-danger/30 bg-danger-soft px-5 py-3.5">
                          <span className="flex-1 text-[15px] font-semibold text-danger">לבטל את התור ל{fmtShortDate(a.date)}?</span>
                          <button type="button" onClick={() => setConfirming(null)} className="h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold">
                            לא, להשאיר
                          </button>
                          <button type="button" onClick={() => cancel(a)} className="h-11 rounded-xl bg-danger px-4 text-sm font-semibold text-white">
                            כן, לבטל
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {waitlist.length > 0 && (
            <section aria-labelledby="h-wait" className="flex flex-col gap-3.5">
              <h2 id="h-wait" className="m-0 text-[19px] font-bold">
                ברשימת המתנה
              </h2>
              {waitlist.map((w) => (
                <div key={w.id} className="flex min-h-[68px] items-center gap-3 rounded-[20px] border border-open-line bg-open-soft pe-3 ps-5">
                  <Bell size={20} className="text-open-text" />
                  <div className="flex flex-1 flex-col gap-[3px]">
                    <span className="text-[15px] font-semibold">{fmtShortDate(w.date)}</span>
                    <span className="text-[13px] text-ink-soft">{PART_LABELS[w.part]} • נודיע בוואטסאפ אם יתפנה</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => backend.waitlist.leave(w.id).catch((e: Error) => toast({ text: e.message, tone: 'error' }))}
                    className="h-11 rounded-xl px-3 text-sm font-semibold text-ink-soft hover:text-ink"
                  >
                    יציאה מהרשימה
                  </button>
                </div>
              ))}
            </section>
          )}
        </div>

        <aside aria-labelledby="h-past" className="flex min-w-[300px] flex-[0_1_380px] flex-col gap-3.5">
          <div className="flex items-baseline justify-between">
            <h2 id="h-past" className="m-0 text-[19px] font-bold">
              היו כבר
            </h2>
            {past.length > 0 && <span className="text-[13px] text-ink-mute">{past.length === 1 ? 'תור אחד' : `${past.length} תורים`}</span>}
          </div>
          {past.length === 0 ? (
            <p className="m-0 rounded-[20px] bg-surface p-5 text-sm text-ink-soft">עוד אין תורים קודמים.</p>
          ) : (
            <div className="overflow-hidden rounded-[20px] border border-line">
              <div className="flex h-10 items-center gap-3 bg-surface px-4 text-xs font-semibold text-ink-soft">
                <span className="flex-1">טיפול</span>
                <span className="w-14 text-left">מחיר</span>
                <span className="w-[84px]" />
              </div>
              {past.slice(0, 12).map((a) => (
                <div key={a.id} className="flex min-h-[60px] items-center gap-3 border-t border-line-soft px-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold">{a.serviceName}</span>
                    <span className="text-xs text-ink-mute">
                      {fmtDayShortMonth(a.date)} • {fmtTime(a.start)}
                    </span>
                  </div>
                  <span className="num w-14 text-left text-sm font-semibold">{priceOf(a) ?? '-'}</span>
                  <span className="flex w-[84px] justify-end">
                    {db.services.some((s) => s.id === a.serviceId) && (
                      <button
                        type="button"
                        aria-label={`קבע שוב ${a.serviceName}`}
                        onClick={() => onBookAgain(a.serviceId)}
                        className="h-9 rounded-[10px] border border-line px-3 text-[13px] font-semibold hover:border-ink-faint"
                      >
                        קבע שוב
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 rounded-[20px] bg-surface p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white">
              <Repeat size={18} />
            </span>
            <div className="flex flex-col gap-0.5">
              {weeks ? <span className="text-sm font-bold">{weeks <= 1 ? 'בדרך כלל כל שבוע' : `בדרך כלל כל ${weeks} שבועות`}</span> : null}
              <span className="text-[13px] text-ink-soft">"קבע שוב" בוחר בשבילך את אותו טיפול.</span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function DateTile({ appt, small, dim }: { appt: Appointment; small?: boolean; dim?: boolean }) {
  const d = fromKey(appt.date);
  return (
    <div
      className={cx(
        'flex shrink-0 flex-col items-center justify-center leading-none',
        small ? 'h-16 w-[60px] gap-1 rounded-[14px]' : 'h-[124px] w-28 gap-1 rounded-[22px]',
        dim ? 'bg-surface text-ink-faint' : 'bg-brand text-brand-accent',
      )}
    >
      <span className={cx('font-medium', small ? 'text-[11px]' : 'text-[15px]')}>{small ? MONTHS_SHORT[d.getMonth()] : `יום ${DAY_LETTERS[weekdayOf(appt.date)]}`}</span>
      <span className={cx('font-bold', small ? 'text-[22px]' : 'text-5xl')}>{d.getDate()}</span>
      {!small && <span className="text-sm font-medium">{MONTHS[d.getMonth()]}</span>}
    </div>
  );
}

function ActionButton({ onClick, icon, danger, children }: { onClick: () => void; icon: ReactNode; danger?: boolean; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'press flex h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold',
        danger ? 'border-danger/30 text-danger hover:bg-danger-soft' : 'border-line hover:border-ink-faint',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

interface HeroProps {
  appt: Appointment;
  price: string | null;
  daysAway: number;
  state: 'active' | 'confirm' | 'cancelled';
  onAsk: () => void;
  onKeep: () => void;
  onCancel: () => void;
  onUndo: () => void;
  onReschedule: () => void;
  onBookNew: () => void;
}

function HeroCard({ appt, price, daysAway, state, onAsk, onKeep, onCancel, onUndo, onReschedule, onBookNew }: HeroProps) {
  const [inCalendar, setInCalendar] = useState(false);
  const off = state === 'cancelled';
  const badge = off ? 'בוטל' : daysAway === 0 ? 'היום' : daysAway === 1 ? 'מחר' : `בעוד ${daysAway} ימים`;
  return (
    <motion.article
      layout
      transition={spring.ui}
      className={cx(
        'overflow-hidden rounded-[28px]',
        state === 'confirm'
          ? 'border-2 border-danger shadow-[0_12px_32px_rgba(28,25,23,0.06)]'
          : off
            ? 'border border-dashed border-line-strong'
            : 'border border-line shadow-[0_12px_32px_rgba(28,25,23,0.06)]',
      )}
    >
      <div className="flex flex-wrap items-center gap-7 p-7">
        <DateTile appt={appt} dim={off} />
        <div className="flex flex-[1_1_260px] flex-col gap-2.5">
          <span className={cx('flex h-7 items-center self-start rounded-full px-3 text-[13px] font-semibold', off ? 'bg-surface text-ink-soft' : 'bg-open-soft text-open-text')}>
            {badge}
          </span>
          <div className={cx('num text-[44px] font-bold leading-none tracking-display', off && 'text-ink-faint line-through')}>{fmtTime(appt.start)}</div>
          <div className="text-lg text-ink-soft">
            {appt.serviceName} • {appt.end - appt.start} דק׳
          </div>
        </div>
        {price && (
          <div className="flex flex-col items-end gap-1">
            <span className="text-[13px] text-ink-mute">לתשלום במספרה</span>
            <span className={cx('num text-[30px] font-bold', off && 'text-ink-faint line-through')}>{price}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 px-7 pb-6 text-sm text-ink-soft">
        <span className="flex items-center gap-2">
          <MapPin size={16} />
          {SHOP.address}
        </span>
        <span className="flex items-center gap-2">
          <MessageCircle size={16} />
          תזכורת בוואטסאפ לפני התור
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {state === 'active' && (
          <motion.div key="a" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap gap-2.5 border-t border-line bg-surface px-7 py-5">
            <button
              type="button"
              aria-pressed={inCalendar}
              onClick={() => {
                addToCalendar({ title: `${appt.serviceName} - ${SHOP.fullName}`, date: appt.date, start: appt.start, end: appt.end, location: SHOP.address, notes: appt.notes });
                setInCalendar(true);
              }}
              className={cx(
                'press flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold',
                inCalendar ? 'border-open-line bg-open-soft text-open-text' : 'border-line bg-white hover:border-ink-faint',
              )}
            >
              <CalendarCheck size={16} />
              {inCalendar ? 'נוסף ליומן' : 'הוספה ליומן'}
            </button>
            <ActionButton onClick={() => openExternal(SHOP.wazeUrl)} icon={<Navigation size={16} />}>
              ניווט ב-Waze
            </ActionButton>
            <ActionButton onClick={onReschedule} icon={<RotateCcw size={16} />}>
              שינוי מועד
            </ActionButton>
            <span className="mr-auto">
              <ActionButton danger onClick={onAsk} icon={<X size={16} />}>
                ביטול התור
              </ActionButton>
            </span>
          </motion.div>
        )}
        {state === 'confirm' && (
          <motion.div
            key="c"
            role="alertdialog"
            aria-labelledby="h-conf"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-wrap items-center gap-3.5 border-t border-danger/30 bg-danger-soft px-7 py-5"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-white text-danger">
              <AlertTriangle size={18} />
            </span>
            <div className="flex flex-[1_1_260px] flex-col gap-0.5">
              <span id="h-conf" className="text-base font-bold text-danger">
                בטוח שרוצים לבטל?
              </span>
              <span className="text-sm text-ink-soft">
                התור ל{fmtShortDate(appt.date)} ב-{fmtTime(appt.start)} יתפנה למישהו אחר.
              </span>
            </div>
            <button type="button" onClick={onKeep} className="h-12 rounded-[14px] border border-line bg-white px-[18px] text-[15px] font-semibold">
              לא, להשאיר
            </button>
            <button type="button" onClick={onCancel} className="h-12 rounded-[14px] bg-danger px-[18px] text-[15px] font-semibold text-white">
              כן, לבטל
            </button>
          </motion.div>
        )}
        {state === 'cancelled' && (
          <motion.div
            key="x"
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-wrap items-center gap-3.5 border-t border-line bg-surface px-7 py-5"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-white text-ink-soft">
              <X size={18} />
            </span>
            <div className="flex flex-[1_1_260px] flex-col gap-0.5">
              <span className="text-base font-bold">התור בוטל</span>
              <span className="text-sm text-ink-soft">השעה התפנתה ללקוחות אחרים.</span>
            </div>
            <button type="button" onClick={onUndo} className="h-12 px-3.5 text-sm font-semibold text-ink-soft underline">
              ביטלתי בטעות
            </button>
            <button type="button" onClick={onBookNew} className="press flex h-12 items-center rounded-[14px] bg-brand px-5 text-[15px] font-semibold text-brand-accent">
              קבע תור חדש
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
