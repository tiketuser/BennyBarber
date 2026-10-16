import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, Check, ChevronLeft, Scissors } from 'lucide-react';
import { useBackend, useDb, useNow, useSession } from '@/data/store';
import { PARTS, PART_LABELS, dayStatus, slotsFor, type DayStatus } from '@/domain/schedule';
import type { DateKey, DayPart, Minutes, Service, WaitlistEntry } from '@/domain/types';
import { addDays, DAY_LETTERS, fmtShortDate, fmtTime, fromKey, MONTHS, todayKey, weekdayOf } from '@/lib/time';
import { haptic } from '@/lib/platform';
import { Button, ScreenHeader } from '@/ui/controls';
import { cx } from '@/ui/cx';
import { spring } from '@/ui/motion';
import { useToast } from '@/ui/useToast';
import { customerPrice } from '../format';

const DAYS = 14;

interface Props {
  service: Service;
  date: DateKey | null;
  start: Minutes | null;
  onPick: (date: DateKey, start: Minutes | null) => void;
  onBack: () => void;
  onContinue: () => void;
  rescheduling: boolean;
  /** True while the details sheet is up: don't drop the picked time when our own booking lands. */
  hold?: boolean;
}

/** Step 2: 14-day strip + time pills grouped by part of day. A full day offers the waitlist instead. */
export function TimeScreen({ service, date, start, onPick, onBack, onContinue, rescheduling, hold }: Props) {
  const db = useDb();
  const now = useNow();
  const today = todayKey(now);
  const days = useMemo(
    () => Array.from({ length: DAYS }, (_, i) => addDays(today, i)).map((d) => ({ date: d, status: dayStatus(db, d, service.durationMin, now) })),
    [db, today, service.durationMin, now],
  );

  // Default to the first day that still has room.
  useEffect(() => {
    if (!date || !days.some((d) => d.date === date)) {
      const first = days.find((d) => d.status === 'open' || d.status === 'almost-full') ?? days.find((d) => d.status === 'full');
      if (first) onPick(first.date, null);
    }
  }, [date, days, onPick]);

  const backend = useBackend();
  const session = useSession();
  const toast = useToast();
  const [part, setPart] = useState<DayPart>('any');
  const [joining, setJoining] = useState(false);
  const myWait = date ? db.waitlist.find((w) => w.date === date && session && w.customerPhone === session.phone) : undefined;
  const join = async () => {
    if (!session || !date) return;
    setJoining(true);
    try {
      await backend.waitlist.join(date, part, session.name ?? '', session.phone);
      haptic('success');
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    } finally {
      setJoining(false);
    }
  };

  const selected = days.find((d) => d.date === date);
  const slots = useMemo(() => (date ? slotsFor(db, date, service.durationMin, now) : []), [db, date, service.durationMin, now]);
  const isFull = selected?.status === 'full';

  // Keep a picked time valid if someone else grabs it meanwhile.
  useEffect(() => {
    if (!hold && start != null && !slots.some((s) => s.start === start && s.available)) onPick(date!, null);
  }, [slots, start, date, onPick, hold]);

  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    stripRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [date]);

  return (
    <>
      <ScreenHeader title={rescheduling ? 'שינוי מועד' : 'מתי נוח לך?'} onBack={onBack} aside={<span className="pl-3 text-[13px] text-ink-soft">שלב 2 מתוך 3</span>} />
      <div aria-hidden className="mx-5 mt-1 flex gap-1.5">
        <span className="h-1 flex-1 rounded bg-beitar-black" />
        <span className="h-1 flex-1 rounded bg-beitar-black" />
        <span className="h-1 flex-1 rounded bg-line" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-36">
        <div className="mx-4 mt-4 flex h-[52px] items-center gap-2.5 rounded-[14px] bg-surface px-3.5">
          <Scissors size={20} className="text-beitar-black" />
          <span className="flex-1 truncate text-[15px] font-medium">
            {service.name}{' '}
            <span className="font-normal text-ink-soft">
              • {service.durationMin} דק׳{service.priceHidden ? '' : ` • ${customerPrice(service)}`}
            </span>
          </span>
          <button type="button" onClick={onBack} className="h-11 text-sm font-medium">
            שינוי
          </button>
        </div>

        <div className="px-5 pb-2.5 pt-5 text-[15px] font-semibold">{date ? MONTHS[fromKey(date).getMonth()] : ''}</div>
        <div ref={stripRef} role="radiogroup" aria-label="בחר יום" className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-4 px-4 pb-1">
          {days.map((d) => (
            <DayPill key={d.date} date={d.date} today={today} status={d.status} on={d.date === date} onPick={() => onPick(d.date, null)} />
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={date ?? 'none'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {isFull && date ? (
              <WaitlistCard date={date} part={part} setPart={setPart} mine={myWait} onLeave={(id) => backend.waitlist.leave(id).catch((e: Error) => toast({ text: e.message, tone: 'error' }))} />
            ) : (
              <div className="flex flex-col gap-[18px] px-4 pt-[22px]">
                {PARTS.map((p) => {
                  const list = slots.filter((s) => s.start >= p.from && s.start < p.to);
                  if (!list.length) return null;
                  return (
                    <div key={p.id} className="flex flex-col gap-2.5">
                      <div className="text-sm font-semibold text-ink-soft">{p.label}</div>
                      <div className="grid grid-cols-4 gap-2">
                        {list.map((s) =>
                          s.available ? (
                            <button
                              key={s.start}
                              type="button"
                              aria-pressed={s.start === start}
                              onClick={() => {
                                haptic();
                                onPick(date!, s.start);
                              }}
                              className={cx(
                                'press num h-11 rounded-xl text-[15px] transition-colors duration-150',
                                s.start === start ? 'bg-beitar-black font-bold text-beitar-yellow' : 'border border-line font-medium',
                              )}
                            >
                              {fmtTime(s.start)}
                            </button>
                          ) : (
                            <button key={s.start} type="button" disabled aria-label={`${fmtTime(s.start)} תפוס`} className="num h-11 rounded-xl bg-surface text-[15px] text-ink-faint line-through">
                              {fmtTime(s.start)}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  );
                })}
                {selected && selected.status !== 'full' && slots.length === 0 && <p className="text-center text-ink-soft">אין שעות פנויות ביום הזה</p>}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {isFull && !myWait && (
        <div className="glass absolute inset-x-0 bottom-0 z-[5] border-t border-line-soft px-4 pt-3 pb-bar-lg">
          <Button block disabled={joining} onClick={join} icon={<Bell size={20} />}>
            היום מלא? היכנס לרשימת המתנה
          </Button>
        </div>
      )}

      {!isFull && (
        <div className="glass absolute inset-x-0 bottom-0 flex items-center gap-3.5 border-t border-line-soft px-4 pt-3 pb-bar-lg">
          {date && start != null && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-ink-soft">{fmtShortDate(date)}</span>
              <span className="num text-[17px] font-bold">{fmtTime(start)}</span>
            </div>
          )}
          <Button className="flex-1" disabled={start == null} onClick={onContinue}>
            {start == null ? 'בחר שעה' : 'המשך'}
            {start != null && <ChevronLeft size={20} />}
          </Button>
        </div>
      )}
    </>
  );
}

function DayPill({ date, today, status, on, onPick }: { date: DateKey; today: DateKey; status: DayStatus; on: boolean; onPick: () => void }) {
  const closed = status === 'closed' || status === 'vacation';
  const top = date === today ? 'היום' : closed ? (status === 'vacation' ? 'חופש' : 'סגור') : DAY_LETTERS[weekdayOf(date)];
  const sub = status === 'full' ? 'מלא' : status === 'almost-full' ? 'כמעט מלא' : null;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={closed}
      aria-label={`${fmtShortDate(date)}${closed ? ' סגור' : sub ? ' ' + sub : ''}`}
      onClick={onPick}
      className={cx(
        'press flex h-[72px] w-14 shrink-0 snap-start flex-col items-center justify-center rounded-2xl transition-colors duration-150',
        on ? 'bg-beitar-black text-white' : closed ? 'bg-surface text-ink-faint' : 'border border-line',
        sub ? 'gap-0.5' : 'gap-1',
      )}
    >
      <span className={cx('text-xs', on ? 'font-medium' : closed ? '' : 'text-ink-soft')}>{top}</span>
      <span className={cx('text-xl', on ? 'font-bold text-beitar-yellow' : 'font-semibold')}>{fromKey(date).getDate()}</span>
      {sub && <span className={cx('text-[10px]', on ? 'text-line-strong' : 'text-danger')}>{sub}</span>}
    </button>
  );
}

function WaitlistCard({ date, part, setPart, mine, onLeave }: { date: DateKey; part: DayPart; setPart: (p: DayPart) => void; mine?: WaitlistEntry; onLeave: (id: string) => void }) {
  const dayLabel = `יום ${DAY_LETTERS[weekdayOf(date)]}`;
  return (
    <AnimatePresence mode="wait" initial={false}>
        {mine ? (
          <motion.section
            key="joined"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring.ui}
            className="mx-4 mt-5 flex flex-col items-center gap-2.5 rounded-[22px] border border-open-line bg-open-soft px-5 py-6 text-center"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-open text-white">
              <Check size={28} strokeWidth={2.5} />
            </span>
            <span className="text-xl font-bold">אתה ברשימת ההמתנה</span>
            <span className="text-[15px] leading-normal">
              {fmtShortDate(date)} • {mine.part === 'any' ? 'כל שעה' : 'ב' + PART_LABELS[mine.part]}
              <br />
              ברגע שמתפנה תור נשלח לך הודעה בוואטסאפ. מי שעונה ראשון תופס.
            </span>
            <button type="button" onClick={() => onLeave(mine.id)} className="h-11 text-sm font-semibold text-ink-soft underline">
              צא מהרשימה
            </button>
          </motion.section>
        ) : (
          <motion.section key="join" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-4 mt-5 flex flex-col gap-3.5 rounded-[22px] bg-surface p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white">
                <Bell size={20} />
              </span>
              <div className="flex flex-col gap-[3px]">
                <span className="text-lg font-bold">{dayLabel} מלא לגמרי</span>
                <span className="text-sm text-ink-soft">אבל כמעט תמיד מישהו מבטל ברגע האחרון</span>
              </div>
            </div>
            <div className="text-sm font-semibold">מתי יתאים לך אם יתפנה?</div>
            <div className="grid grid-cols-2 gap-2">
              {(['morning', 'noon', 'evening', 'any'] as DayPart[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={p === part}
                  onClick={() => setPart(p)}
                  className={cx('press h-12 rounded-[14px] text-[15px] font-semibold', p === part ? 'bg-beitar-black text-beitar-yellow' : 'border border-line bg-white')}
                >
                  {PART_LABELS[p]}
                </button>
              ))}
            </div>
          </motion.section>
        )}
    </AnimatePresence>
  );
}
