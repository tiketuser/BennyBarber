import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle, Trash2 } from 'lucide-react';
import { useBackend, useDb, useNow } from '@/data/store';
import type { Appointment, DateKey } from '@/domain/types';
import { haptic } from '@/lib/platform';
import { DAY_LETTERS, MONTHS, fmtDayMonth, fmtDayMonthRange, fmtTime, fromKey, toKey, todayKey, weekdayOf } from '@/lib/time';
import { Bubble, Switch } from '@/ui/controls';
import { cx } from '@/ui/cx';
import { useToast } from '@/ui/useToast';
import { firstName } from '../../format';
import { useSendQueue } from '../useSendQueue';
import { vacationMessage } from '../vacation';

const SHOWN = 5;

/** "ימי חופש" as a page: two months side by side, the affected appointments and the WhatsApp notice beside them. */
export function DeskVacation() {
  const backend = useBackend();
  const db = useDb();
  const now = useNow();
  const toast = useToast();
  const today = todayKey(now);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [start, setStart] = useState<DateKey | null>(null);
  const [end, setEnd] = useState<DateKey | null>(null);
  const [notify, setNotify] = useState(true);
  const [saved, setSaved] = useState<{ range: string; affected: Appointment[] } | null>(null);

  const last = end ?? start;
  const days = start ? Math.round((fromKey(last!).getTime() - fromKey(start).getTime()) / 86400000) + 1 : 0;
  const booked = useMemo(
    () =>
      start
        ? db.appointments
            .filter((a) => a.status === 'booked' && a.date >= start && a.date <= last!)
            .sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1))
        : [],
    [db.appointments, start, last],
  );
  const perDay = useMemo(() => {
    const m = new Map<DateKey, number>();
    for (const a of db.appointments) if (a.status === 'booked' && a.date >= today) m.set(a.date, (m.get(a.date) ?? 0) + 1);
    return m;
  }, [db.appointments, today]);
  const rangeText = !start ? '' : days === 1 ? fmtDayMonth(start) : fmtDayMonthRange(start, last!);
  const queue = useSendQueue((saved?.affected ?? []).filter((a) => a.phone).map((a) => ({ key: a.id, name: a.customerName, phone: a.phone, text: vacationMessage(a) })));
  const vacations = db.settings.vacations.filter((v) => v.to >= today).sort((a, b) => (a.from < b.from ? -1 : 1));

  const pick = (d: DateKey) => {
    setSaved(null);
    if (!start || end) {
      setStart(d);
      setEnd(null);
    } else if (d < start) setStart(d);
    else setEnd(d);
  };
  const clear = () => {
    setStart(null);
    setEnd(null);
    setSaved(null);
  };
  const save = async () => {
    if (!start) return;
    const hit = booked;
    try {
      await backend.settings.addVacation(start, last!);
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
      return;
    }
    haptic('success');
    setSaved({ range: rangeText, affected: notify ? hit : [] });
    setStart(null);
    setEnd(null);
  };

  const months = [0, 1].map((n) => {
    const first = fromKey(month + '-01');
    return toKey(new Date(first.getFullYear(), first.getMonth() + n, 1)).slice(0, 7);
  });
  const shift = (n: number) => {
    const first = fromKey(month + '-01');
    setMonth(toKey(new Date(first.getFullYear(), first.getMonth() + n, 1)).slice(0, 7));
  };

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-brand text-[32px] font-normal leading-tight">ימי חופש</h1>
          <span className="text-[15px] text-ink-soft">לחץ על יום ההתחלה ואז על יום הסוף. לקוחות לא יוכלו לקבוע תור בימים האלה.</span>
        </div>
        <button type="button" onClick={clear} disabled={!start} className="mr-auto h-11 rounded-xl border border-line px-4 text-sm font-semibold disabled:opacity-35">
          נקה בחירה
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-label="בחירת ימים" className="relative flex min-w-0 flex-[1_1_620px] flex-wrap gap-8 rounded-[20px] border border-line px-6 py-[22px]">
          <button
            type="button"
            aria-label="חודש קודם"
            disabled={month <= today.slice(0, 7)}
            onClick={() => shift(-1)}
            className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full hover:bg-surface disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            aria-label="חודש הבא"
            onClick={() => shift(1)}
            className="absolute left-4 top-4 flex size-9 items-center justify-center rounded-full hover:bg-surface"
          >
            <ChevronLeft size={18} />
          </button>
          {months.map((m) => {
            const first = fromKey(m + '-01');
            const len = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
            return (
              <div key={m} className="flex min-w-0 flex-[1_1_260px] flex-col gap-2.5">
                <h2 className="m-0 text-center text-[17px] font-bold">
                  {MONTHS[first.getMonth()]} {first.getFullYear()}
                </h2>
                <div aria-hidden className="grid grid-cols-7 text-center text-xs font-semibold text-ink-soft">
                  {DAY_LETTERS.map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-y-1">
                  {Array.from({ length: first.getDay() }, (_, i) => (
                    <span key={`e${i}`} />
                  ))}
                  {Array.from({ length: len }, (_, i) => {
                    const d = `${m}-${String(i + 1).padStart(2, '0')}`;
                    const past = d < today;
                    const edge = d === start || d === last;
                    const mid = !!start && d > start && d < last! && !edge;
                    const count = perDay.get(d) ?? 0;
                    const onVacation = db.settings.vacations.some((v) => d >= v.from && d <= v.to);
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={past}
                        aria-pressed={edge || mid}
                        aria-label={`${i + 1} ב${MONTHS[first.getMonth()]}${count ? `, ${count} תורים` : ''}${onVacation ? ', חופש' : ''}`}
                        onClick={() => pick(d)}
                        className={cx(
                          'num flex h-12 flex-col items-center justify-center gap-0.5 text-[15px] font-medium',
                          past && 'text-line-strong',
                          !past && weekdayOf(d) === 6 && !edge && 'text-ink-mute',
                          edge
                            ? 'rounded-xl bg-brand font-bold text-brand-accent'
                            : mid
                              ? 'bg-surface-sunk'
                              : 'rounded-xl hover:outline hover:outline-1 hover:-outline-offset-1 hover:outline-ink-faint',
                          d === today && !edge && 'font-bold shadow-[inset_0_0_0_2px_theme(colors.brand.accent)]',
                          onVacation && !edge && !mid && 'bg-danger-soft text-danger',
                        )}
                      >
                        <span>{i + 1}</span>
                        <span className={cx('size-1 rounded-full', !past && count ? (edge ? 'bg-brand-accent' : 'bg-ink-faint') : 'bg-transparent')} />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="flex flex-[1_1_100%] flex-wrap gap-[18px] border-t border-line-soft pt-3.5 text-[13px] text-ink-soft">
            <Legend swatch="size-3.5 rounded bg-brand">התחלה וסוף</Legend>
            <Legend swatch="size-3.5 rounded bg-surface-sunk">בטווח</Legend>
            <Legend swatch="size-1.5 rounded-full bg-ink-faint">יש תורים ביום</Legend>
            <Legend swatch="size-3.5 rounded border border-brand-accent">היום</Legend>
            <Legend swatch="size-3.5 rounded bg-danger-soft">כבר חופש</Legend>
          </div>
        </section>

        <aside aria-label="סיכום" className="flex min-w-[300px] flex-[0_1_380px] flex-col gap-3.5">
          {saved ? (
            <>
              <div role="status" className="flex flex-col gap-2 rounded-[20px] bg-open-soft p-5 text-open-text">
                <span className="text-[13px]">החופש נשמר</span>
                <span className="text-2xl font-bold leading-tight">{saved.range}</span>
                <span className="text-sm">{saved.affected.length ? 'התורים בימים האלה בוטלו. שלח לכל לקוח הודעה:' : 'הימים סומנו כחופש.'}</span>
              </div>
              {queue.total > 0 && (
                <section aria-label="הודעות ללקוחות" className="flex flex-col gap-2 rounded-[20px] border border-line p-4">
                  {(saved.affected ?? [])
                    .filter((a) => a.phone)
                    .map((a) => {
                      const sent = queue.isSent(a.id);
                      return (
                        <div key={a.id} className="flex h-12 items-center gap-2.5 border-b border-line-soft last:border-0">
                          <span className="flex-1 text-sm font-semibold">{a.customerName}</span>
                          <span className="num text-[13px] text-ink-soft">
                            {fmtDayMonth(a.date)} • {fmtTime(a.start)}
                          </span>
                          <button
                            type="button"
                            onClick={() => queue.send({ key: a.id, name: a.customerName, phone: a.phone, text: vacationMessage(a) })}
                            className={cx('h-9 rounded-[10px] px-3 text-[13px] font-semibold', sent ? 'text-open-text' : 'bg-open text-white')}
                          >
                            {sent ? 'נשלח ✓' : 'שלח'}
                          </button>
                        </div>
                      );
                    })}
                  {queue.next && (
                    <button
                      type="button"
                      onClick={queue.sendNext}
                      className="press mt-1 flex h-12 items-center justify-center gap-2 rounded-[14px] bg-open text-[15px] font-semibold text-white"
                    >
                      <MessageCircle size={18} />
                      שלח ל{firstName(queue.next.name)} ({queue.sentCount + 1}/{queue.total})
                    </button>
                  )}
                </section>
              )}
            </>
          ) : (
            <>
              <div aria-live="polite" className="flex flex-col gap-2 rounded-[20px] bg-brand p-5 text-white">
                <span className="text-[13px] text-line-strong">הטווח שנבחר</span>
                <span className="text-2xl font-bold leading-tight">{start ? rangeText : 'עוד לא נבחרו ימים'}</span>
                {start && (
                  <div className="flex flex-wrap gap-2">
                    <span className="flex h-7 items-center rounded-full bg-brand-accent px-3 text-[13px] font-bold text-brand">{days === 1 ? 'יום אחד' : `${days} ימים`}</span>
                    <span className="flex h-7 items-center rounded-full bg-white/10 px-3 text-[13px] font-semibold">
                      {booked.length === 1 ? 'תור אחד בימים האלה' : `${booked.length} תורים בימים האלה`}
                    </span>
                  </div>
                )}
              </div>

              <section aria-labelledby="h-aff" className="flex flex-col gap-1 rounded-[20px] border border-line px-[18px] py-4">
                <h2 id="h-aff" className="m-0 mb-1.5 text-base font-bold">
                  תורים שיבוטלו
                </h2>
                {booked.slice(0, SHOWN).map((a) => (
                  <div key={a.id} className="flex min-h-11 items-center gap-2.5 border-b border-line-soft">
                    <div className="flex w-[92px] flex-col">
                      <span className="text-[13px] font-semibold">
                        יום {DAY_LETTERS[weekdayOf(a.date)]} {fmtDayMonth(a.date)}
                      </span>
                      <span className="num text-xs text-ink-mute">{fmtTime(a.start)}</span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{a.customerName}</span>
                      <span className="truncate text-xs text-ink-mute">{a.serviceName}</span>
                    </div>
                  </div>
                ))}
                {booked.length > SHOWN && <span className="pt-2 text-[13px] text-ink-soft">ועוד {booked.length - SHOWN} תורים</span>}
                {booked.length === 0 && <span className="py-1.5 text-sm text-ink-soft">{start ? 'אין תורים בימים האלה' : 'בחר ימים כדי לראות אילו תורים יבוטלו'}</span>}
              </section>

              {booked.length > 0 && (
                <section className="flex flex-col gap-3 rounded-[20px] border border-line px-[18px] py-4">
                  <div className="flex min-h-11 items-center gap-3">
                    <span className="flex-1 text-[15px] font-semibold">שלח ללקוחות האלה וואטסאפ לקביעה מחדש</span>
                    <Switch checked={notify} onChange={setNotify} label="שלח ללקוחות וואטסאפ" />
                  </div>
                  {notify && (
                    <div className="rounded-[14px] bg-surface p-3">
                      <Bubble>{vacationMessage(booked[0])}</Bubble>
                    </div>
                  )}
                </section>
              )}

              <button
                type="button"
                onClick={save}
                disabled={!start}
                className="press h-14 rounded-2xl bg-brand text-[17px] font-semibold text-brand-accent disabled:bg-surface disabled:text-ink-faint"
              >
                {!start ? 'בחר ימים' : `סמן ${days === 1 ? 'יום' : `${days} ימים`} כחופש`}
              </button>
            </>
          )}

          {vacations.length > 0 && (
            <section aria-labelledby="h-vac" className="flex flex-col gap-1 rounded-[20px] bg-surface px-[18px] py-4">
              <h2 id="h-vac" className="m-0 mb-1 text-sm font-bold">
                חופשים קרובים
              </h2>
              {vacations.map((v) => (
                <div key={v.id} className="flex h-10 items-center gap-2 text-sm">
                  <span className="num flex-1 font-medium">{v.from === v.to ? fmtDayMonth(v.from) : fmtDayMonthRange(v.from, v.to)}</span>
                  <button
                    type="button"
                    aria-label="מחק חופש"
                    onClick={() => backend.settings.removeVacation(v.id)}
                    className="flex size-9 items-center justify-center rounded-full text-ink-soft hover:bg-white hover:text-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Legend({ swatch, children }: { swatch: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={swatch} />
      {children}
    </span>
  );
}
