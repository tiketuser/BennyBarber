import { useMemo, useState, type ReactNode } from 'react';
import { Ban, Check, MessageCircle, Plus } from 'lucide-react';
import { useBackend, useDb, useNow } from '@/data/store';
import { busyFor, freeGaps, hoursFor } from '@/domain/schedule';
import type { Appointment, Block, DateKey, Minutes } from '@/domain/types';
import { SHOP } from '@/config/shop';
import { whatsappUrl } from '@/lib/links';
import { isValidMobile, formatPhone } from '@/lib/phone';
import { haptic, openExternal } from '@/lib/platform';
import { addDays, DAY_LETTERS, fmtDayMonth, fmtLongDate, fmtRange, fmtShortDate, fmtTime, nowMinutes, todayKey, weekdayOf } from '@/lib/time';
import { Switch } from '@/ui/controls';
import { cx } from '@/ui/cx';
import { useToast } from '@/ui/useToast';
import { firstName, money } from '../../format';

type Mode = 'appt' | 'block';
const LENGTHS = [
  { len: 30, label: '30 דק׳' },
  { len: 60, label: 'שעה' },
  { len: 0, label: 'עד הסוף' },
] as const;
const DAYS = 5;
const TIMELINE_PX = 600;

/** "תור מהיר" as a page: the form on one side, the chosen day's timeline (with the new item in place) on the other. */
export function DeskQuick({ initialDate, initialStart }: { initialDate: DateKey; initialStart: Minutes | null }) {
  const db = useDb();
  const now = useNow();
  const backend = useBackend();
  const toast = useToast();
  const today = todayKey(now);
  const services = useMemo(() => [...db.services].sort((a, b) => a.order - b.order), [db.services]);

  const [mode, setMode] = useState<Mode>('appt');
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [lenIdx, setLenIdx] = useState(0);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(today, i));
  // Opened from a free slot: that day. Otherwise the first day that still has room.
  const [date, setDate] = useState<DateKey>(() => (initialStart != null && initialDate >= today ? initialDate : (days.find((d) => freeGaps(db, d, 20, now).length > 0) ?? today)));
  const [picked, setPicked] = useState<Minutes | null>(initialStart);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [wa, setWa] = useState(true);
  const [done, setDone] = useState<{ title: string; sub: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const service = services.find((s) => s.id === serviceId) ?? services[0];
  const hours = hoursFor(db.settings, date);
  const isAppt = mode === 'appt';
  const need = isAppt ? (service?.durationMin ?? 30) : 15;

  // Start options: each free window's start, plus every half hour inside it that still fits.
  const options = useMemo(() => {
    const out: Minutes[] = [];
    for (const g of freeGaps(db, date, need, now)) {
      out.push(g.from);
      for (let t = Math.ceil((g.from + 1) / 30) * 30; t + need <= g.to; t += 30) out.push(t);
    }
    return out;
  }, [db, date, need, now]);
  const start = picked != null && options.includes(picked) ? picked : (options[0] ?? null);

  const items = busyFor(db, date);
  let end: Minutes | null = null;
  if (start != null && hours) {
    if (isAppt) end = start + need;
    else {
      const len = LENGTHS[lenIdx].len;
      const nextBusy = Math.min(hours.to, ...items.filter((b) => b.from >= start + 1).map((b) => b.from));
      end = len === 0 ? hours.to : Math.min(start + len, nextBusy);
    }
  }
  const after = !isAppt && start != null && LENGTHS[lenIdx].len === 0 ? items.filter((b) => b.kind === 'appointment' && b.from >= start).length : 0;
  const shortened = !isAppt && start != null && end != null && LENGTHS[lenIdx].len > 0 && end - start < LENGTHS[lenIdx].len;
  const warn = after
    ? `${after === 1 ? `יש עוד תור אחד אחרי ${fmtTime(start!)}, הוא נשאר` : `יש עוד ${after} תורים אחרי ${fmtTime(start!)}, הם נשארים`} ביומן. רק הזמן הפנוי נחסם.`
    : shortened
      ? `החסימה מסתיימת ב-${fmtTime(end!)} כי אחריה יש תור קבוע.`
      : '';
  const phoneOk = isValidMobile(phone);
  const shortDay = date === today ? 'היום' : `${DAY_LETTERS[weekdayOf(date)]} ${fmtDayMonth(date)}`;
  const who = name.trim() || 'לקוח מזדמן';

  const reset = () => {
    setDone(null);
    setName('');
    setPhone('');
    setNotes('');
  };
  const change =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setDone(null);
    };

  const save = async () => {
    if (start == null || end == null || !service || busy) return;
    setBusy(true);
    try {
      if (isAppt) {
        const a = await backend.appointments.addWalkIn({ serviceId: service.id, date, start, customerName: name, phone, notes });
        const confirm = phoneOk && wa;
        if (confirm)
          openExternal(
            whatsappUrl(
              phone,
              `היי ${firstName(a.customerName)}, קבענו לך תור ל${a.serviceName} ${date === today ? 'היום' : `ב${fmtShortDate(date)}`} ב-${fmtTime(start)} ב${SHOP.fullName}. נתראה!`,
            ),
          );
        setDone({
          title: `התור של ${a.customerName} נוסף ליומן`,
          sub: `${shortDay} • ${fmtRange(start, end)} • ${service.shortName} ${money(a.price)}${confirm ? ' • נפתח וואטסאפ עם האישור' : ''}`,
        });
      } else {
        await backend.blocks.add(date, start, end, notes.trim() || 'חסום');
        setDone({ title: 'הזמן נחסם ביומן', sub: `${shortDay} • ${fmtRange(start, end)}` });
      }
      haptic('success');
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-[22px]">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-brand text-[32px] font-normal leading-tight">תור מהיר</h1>
          <span className="text-[15px] text-ink-soft">הוסף לקוח ליומן או חסום זמן, ותראה מיד איפה זה נופל ביום</span>
        </div>
        <div role="group" aria-label="סוג פעולה" className="mr-auto flex h-12 gap-1 rounded-[14px] bg-surface p-1">
          <button
            type="button"
            aria-pressed={isAppt}
            onClick={() => change(setMode)('appt')}
            className={cx('flex h-10 items-center gap-2 rounded-[10px] px-[18px] text-sm font-semibold', isAppt ? 'bg-brand text-brand-accent' : 'text-ink-soft')}
          >
            <Plus size={18} />
            תור חדש
          </button>
          <button
            type="button"
            aria-pressed={!isAppt}
            onClick={() => change(setMode)('block')}
            className={cx('flex h-10 items-center gap-2 rounded-[10px] px-[18px] text-sm font-semibold', !isAppt ? 'bg-danger text-white' : 'text-ink-soft')}
          >
            <Ban size={18} />
            חסימת זמן
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-7">
        <section aria-label={isAppt ? 'פרטי תור חדש' : 'פרטי חסימת זמן'} className="flex min-w-0 flex-[1_1_520px] flex-col gap-5">
          {isAppt ? (
            <>
              <div className="flex flex-wrap gap-3">
                <Labeled id="qname" label="שם הלקוח">
                  <input
                    id="qname"
                    autoComplete="off"
                    placeholder="למשל: רון ביטון"
                    value={name}
                    onChange={(e) => change(setName)(e.target.value)}
                    className="h-[50px] rounded-[14px] border border-line px-3.5 outline-none focus:border-brand"
                  />
                </Labeled>
                <Labeled id="qphone" label="טלפון (לא חובה)">
                  <input
                    id="qphone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    dir="ltr"
                    placeholder="05X-XXXXXXX"
                    value={phone}
                    onChange={(e) => change(setPhone)(formatPhone(e.target.value))}
                    className="h-[50px] rounded-[14px] border border-line px-3.5 text-right outline-none focus:border-brand"
                  />
                </Labeled>
              </div>
              <div className="flex flex-col gap-2">
                <span id="l-svc" className="text-sm font-semibold">
                  טיפול
                </span>
                <div role="group" aria-labelledby="l-svc" className="flex flex-wrap gap-2">
                  {services.map((s) => {
                    const on = s.id === service?.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => change(setServiceId)(s.id)}
                        className={cx(
                          'flex h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold',
                          on ? 'bg-brand text-white' : 'border border-line hover:border-ink-faint',
                        )}
                      >
                        {s.shortName}
                        <span className={cx('font-normal', on ? 'text-brand-accent' : 'text-ink-mute')}>
                          {money(s.price)} • {s.durationMin} דק׳
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl bg-danger-soft px-4 py-3.5 text-sm leading-normal text-danger">לקוחות לא יוכלו לקבוע תור בזמן החסום. תורים שכבר קבועים נשארים ביומן.</div>
              <div className="flex flex-col gap-2">
                <span id="l-len" className="text-sm font-semibold">
                  כמה זמן לחסום
                </span>
                <div role="group" aria-labelledby="l-len" className="grid grid-cols-3 gap-2">
                  {LENGTHS.map((l, i) => (
                    <button
                      key={l.label}
                      type="button"
                      aria-pressed={i === lenIdx}
                      onClick={() => change(setLenIdx)(i)}
                      className={cx('h-14 rounded-2xl text-base font-semibold', i === lenIdx ? 'bg-danger text-white' : 'bg-danger-soft text-danger')}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col gap-2">
            <span id="l-day" className="text-sm font-semibold">
              יום
            </span>
            <div role="group" aria-labelledby="l-day" className="grid grid-cols-5 gap-2">
              {days.map((d) => {
                const closed = !hoursFor(db.settings, d);
                const on = d === date;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={closed}
                    aria-pressed={on}
                    aria-label={closed ? `${fmtShortDate(d)} סגור` : fmtLongDate(d)}
                    onClick={() => {
                      change(setDate)(d);
                      setPicked(null);
                    }}
                    className={cx(
                      'flex h-[68px] flex-col items-center justify-center gap-[3px] rounded-2xl',
                      closed ? 'bg-surface text-ink-faint' : on ? 'bg-brand text-white' : 'border border-line hover:border-ink-faint',
                    )}
                  >
                    <span className="text-[15px] font-bold">{d === today ? 'היום' : DAY_LETTERS[weekdayOf(d)]}</span>
                    <span className={cx('text-xs', on ? 'text-brand-accent' : 'text-ink-mute')}>
                      {closed ? 'סגור' : d === today ? `${DAY_LETTERS[weekdayOf(d)]} ${fmtDayMonth(d)}` : fmtDayMonth(d)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span id="l-time" className="text-sm font-semibold">
              {isAppt ? `שעה פנויה (${need} דק׳)` : 'מאיזו שעה לחסום'}
            </span>
            {options.length ? (
              <div role="group" aria-labelledby="l-time" className="flex flex-wrap gap-2">
                {options.map((t) => {
                  const on = t === start;
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => change(setPicked)(t)}
                      className={cx(
                        'num h-11 min-w-[84px] rounded-xl px-3.5 text-[15px] font-semibold',
                        on ? (isAppt ? 'bg-brand text-brand-accent' : 'bg-danger text-white') : 'border border-line hover:border-ink-faint',
                      )}
                    >
                      {fmtTime(t)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[14px] border border-dashed border-ink-faint px-4 py-3.5 text-sm text-ink-soft">
                {!hours ? `${SHOP.closed} ביום הזה.` : isAppt ? `אין ביום הזה חלון פנוי של ${need} דק׳. נסה יום אחר או טיפול קצר יותר.` : 'אין זמן פנוי לחסום ביום הזה.'}
              </div>
            )}
            {warn && !done && <span className="text-[13px] text-danger">{warn}</span>}
          </div>

          <Labeled id="qnotes" label={isAppt ? 'הערה לתור (לא חובה)' : 'סיבת החסימה (לא חובה)'}>
            <textarea
              id="qnotes"
              rows={2}
              value={notes}
              onChange={(e) => change(setNotes)(e.target.value)}
              placeholder={isAppt ? 'למשל: קצר בצדדים, להשאיר אורך למעלה' : 'למשל: סידורים, איסוף מהגן'}
              className="resize-none rounded-[14px] border border-line px-3.5 py-3 text-[15px] outline-none focus:border-brand"
            />
          </Labeled>

          {isAppt && phoneOk && !done && (
            <div className="flex h-[52px] items-center gap-2.5 rounded-[14px] bg-open-soft px-3.5 text-open-text">
              <MessageCircle size={18} />
              <span className="flex-1 text-sm font-semibold">שלח אישור ללקוח בוואטסאפ</span>
              <Switch checked={wa} onChange={setWa} label="שלח אישור ללקוח בוואטסאפ" />
            </div>
          )}

          {done ? (
            <div role="status" className="flex items-center gap-3 rounded-2xl border border-open-line bg-open-soft p-4 text-open-text">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-open text-white">
                <Check size={20} strokeWidth={2.5} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base font-bold">{done.title}</span>
                <span className="text-[13px]">{done.sub}</span>
              </div>
              <button type="button" onClick={reset} className="h-11 rounded-xl bg-white px-4 text-sm font-semibold">
                עוד אחד
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={start == null || busy}
              onClick={save}
              className={cx('press h-14 rounded-2xl text-[17px] font-semibold disabled:opacity-40', isAppt ? 'bg-brand text-brand-accent' : 'bg-danger text-white')}
            >
              {start == null || end == null ? 'אין שעה פנויה' : isAppt ? `הוסף ליומן - ${shortDay}, ${fmtRange(start, end)}` : `חסום ${shortDay}, ${fmtRange(start, end)}`}
            </button>
          )}
        </section>

        <DayPreview
          date={date}
          pending={
            !done && start != null && end != null
              ? { from: start, to: end, label: isAppt ? `${who} • ${service?.shortName ?? ''}` : `חסימה${notes.trim() ? ' • ' + notes.trim() : ''}`, block: !isAppt }
              : null
          }
          now={now}
        />
      </div>
    </div>
  );
}

function Labeled({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

/** The day on a time scale, with the item being added drawn in place. */
function DayPreview({ date, pending, now }: { date: DateKey; pending: { from: Minutes; to: Minutes; label: string; block: boolean } | null; now: Date }) {
  const db = useDb();
  const hours = hoursFor(db.settings, date);
  const items = busyFor(db, date);
  const count = items.filter((b) => b.kind === 'appointment').length;

  return (
    <aside aria-label="היומן של היום הנבחר" className="sticky top-7 flex min-w-[300px] flex-[0_1_400px] flex-col gap-3.5 rounded-[20px] border border-line p-5">
      <div className="flex flex-col gap-0.5">
        <span className="text-base font-bold">{fmtLongDate(date)}</span>
        <span className="text-[13px] text-ink-soft">{hours ? `פתוח ${fmtRange(hours.from, hours.to)} • ${count} תורים` : 'סגור'}</span>
      </div>
      {hours && <Scale from={hours.from} to={hours.to} items={items} pending={pending} nowM={date === todayKey(now) ? nowMinutes(now) : null} />}
    </aside>
  );
}

function Scale({
  from,
  to,
  items,
  pending,
  nowM,
}: {
  from: Minutes;
  to: Minutes;
  items: ReturnType<typeof busyFor>;
  pending: { from: Minutes; to: Minutes; label: string; block: boolean } | null;
  nowM: Minutes | null;
}) {
  const ppm = TIMELINE_PX / (to - from);
  const pos = (s: Minutes, e: Minutes) => ({ top: Math.round((s - from) * ppm), height: Math.max(18, Math.round((e - s) * ppm) - 3) });
  const every = to - from > 420 ? 60 : 30;
  const marks: Minutes[] = [];
  for (let t = Math.ceil(from / every) * every; t <= to; t += every) marks.push(t);

  return (
    <div className="relative mr-12" style={{ height: TIMELINE_PX }}>
      {marks.map((t) => (
        <div key={t} className="absolute inset-x-0 border-t border-line-soft" style={{ top: Math.round((t - from) * ppm) }}>
          <span className="num absolute -right-12 -top-2 w-10 text-left text-[11px] text-ink-mute">{fmtTime(t)}</span>
        </div>
      ))}
      {items.map((b) => {
        const label = b.kind === 'appointment' ? (b.ref as Appointment).customerName : b.kind === 'block' ? ((b.ref as Block).label ?? 'חסום') : 'הפסקה';
        return (
          <div
            key={`${b.kind}-${b.from}`}
            className={cx(
              'absolute inset-x-0 flex flex-col justify-center overflow-hidden rounded-[10px] px-2.5 text-[12px] leading-tight',
              b.kind === 'appointment'
                ? 'z-[1] bg-brand text-white'
                : b.kind === 'block'
                  ? 'border border-danger/40 bg-danger-soft text-danger'
                  : 'border border-dashed border-line-strong bg-white text-ink-mute',
            )}
            style={pos(b.from, b.to)}
          >
            <span className="truncate font-semibold">{label}</span>
            <span className="num truncate opacity-75">{fmtRange(b.from, b.to)}</span>
          </div>
        );
      })}
      {pending && (
        <div
          className={cx(
            'absolute inset-x-0 z-[2] flex flex-col justify-center overflow-hidden rounded-[10px] border-2 border-dashed px-2.5 text-[12px] leading-tight',
            pending.block ? 'border-danger bg-danger-soft text-danger' : 'border-brand bg-white text-brand shadow-[0_6px_18px_rgba(28,25,23,0.14)]',
          )}
          style={pos(pending.from, pending.to)}
        >
          <span className="truncate font-semibold">
            {pending.label} <span className="rounded-full bg-brand-accent px-1.5 text-[10px] text-brand">חדש</span>
          </span>
          <span className="num truncate opacity-75">{fmtRange(pending.from, pending.to)}</span>
        </div>
      )}
      {nowM != null && nowM > from && nowM < to && (
        <div aria-hidden className="absolute inset-x-0 z-[3] border-t-2 border-open" style={{ top: Math.round((nowM - from) * ppm) }}>
          <span className="absolute -top-[5px] left-0 size-2 rounded-full bg-open" />
        </div>
      )}
    </div>
  );
}
