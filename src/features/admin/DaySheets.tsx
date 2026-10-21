import { useMemo, useState } from 'react';
import { ArrowLeft, Ban, CalendarPlus, Check, MessageCircle, Plus, Share2 } from 'lucide-react';
import { useBackend, useDb, useNow } from '@/data/store';
import { freeGaps, hoursFor } from '@/domain/schedule';
import type { Appointment, Block, DateKey, Minutes } from '@/domain/types';
import { SHOP } from '@/config/shop';
import { whatsappUrl } from '@/lib/links';
import { addToCalendar, downloadIcs, haptic, icsFile, openExternal, shareText, type CalendarEvent } from '@/lib/platform';
import { formatPhone } from '@/lib/phone';
import { fmtRange, fmtShortDate, fmtTime, nowMinutes, todayKey } from '@/lib/time';
import { Bubble, Button, Stepper } from '@/ui/controls';
import { cx } from '@/ui/cx';
import { Sheet, SheetTitle } from '@/ui/Sheet';
import { useOnChange } from '@/ui/useOnChange';
import { useToast } from '@/ui/useToast';
import { firstName } from '../format';
import { useReleaseBlock } from './useReleaseBlock';
import { useSendQueue } from './useSendQueue';

/** "חלונות פנויים": every free window today, with add-client / block, and share to WhatsApp status. */
export function FreeSlotsSheet({ open, onClose, date, onAdd }: { open: boolean; onClose: () => void; date: DateKey; onAdd: (start: Minutes) => void }) {
  const db = useDb();
  const backend = useBackend();
  const toast = useToast();
  const now = useNow();
  const gaps = freeGaps(db, date, 20, now);
  const total = gaps.reduce((t, g) => t + g.to - g.from, 0);
  const isToday = date === todayKey(now);
  const totalLabel = total >= 60 ? `${Math.floor(total / 60)} שע׳${total % 60 ? ` ו-${total % 60} דק׳` : ''}` : `${total} דק׳`;

  const share = () => {
    const when = isToday ? 'היום' : fmtShortDate(date);
    shareText(`נשארו תורים פנויים ${when}: ${gaps.map((g) => fmtTime(g.from)).join(', ')}. לקביעה מהירה: ${SHOP.appUrl}`);
  };

  const block = async (from: Minutes, to: Minutes) => {
    try {
      const b = await backend.blocks.add(date, from, to, 'חסום');
      haptic();
      toast({ text: `נחסם ${fmtRange(from, to)}`, action: { label: 'ביטול', run: () => backend.blocks.remove(b.id) } });
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="חלונות פנויים"
      footer={
        gaps.length > 0 && (
          <Button block variant="open" icon={<Share2 size={20} />} onClick={share}>
            שתף את השעות הפנויות בסטטוס
          </Button>
        )
      }
    >
      <SheetTitle aside={gaps.length ? `${gaps.length === 1 ? 'חלון אחד' : `${gaps.length} חלונות`} • ${totalLabel} בסך הכל` : undefined}>
        {isToday ? 'פנוי היום' : `פנוי ב${fmtShortDate(date)}`}
      </SheetTitle>
      {gaps.length === 0 && <p className="py-6 text-center text-ink-soft">היומן מלא. אין חלונות פנויים.</p>}
      <div className="mt-4 flex flex-col gap-2.5 pb-2">
        {gaps.map((g, i) => (
          <article key={g.from} className="flex flex-col gap-3 rounded-[18px] border border-line p-3.5">
            <div className="flex items-center gap-3">
              <div className="w-1.5 self-stretch rounded-full bg-open-dot" />
              <div className="flex flex-1 flex-col gap-[3px]">
                <span className="num text-xl font-bold">{fmtRange(g.from, g.to)}</span>
                <span className="text-[13px] text-ink-soft">
                  {g.to - g.from} דק׳ • {fits(db.services, g.to - g.from)}
                  {i === gaps.length - 1 && g.to === hoursFor(db.settings, date)?.to ? ' • התור האחרון של היום' : ''}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" icon={<Plus size={18} />} onClick={() => onAdd(g.from)}>
                הוסף לקוח
              </Button>
              <Button size="sm" variant="danger" className="flex-1" icon={<Ban size={18} />} onClick={() => block(g.from, g.to)}>
                חסום
              </Button>
            </div>
          </article>
        ))}
      </div>
    </Sheet>
  );
}

function fits(services: { shortName: string; durationMin: number }[], len: number) {
  const ok = services.filter((s) => s.durationMin <= len).map((s) => s.shortName);
  return ok.length === services.length ? 'מתאים לכל טיפול' : ok.length ? `מתאים ל${ok.join(', ')}` : 'קצר מדי לטיפול';
}

/** "מתעכב": tell the next clients you're running late. */
export function DelaySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDb();
  const now = useNow();
  const today = todayKey(now);
  const upcoming = useMemo(
    () => db.appointments.filter((a) => a.date === today && a.status === 'booked' && a.end > nowMinutes(now) && a.phone).sort((a, b) => a.start - b.start),
    [db.appointments, today, now],
  );
  const [delay, setDelay] = useState(15);
  const [until, setUntil] = useState<Minutes>(0);
  const first = upcoming[0]?.start ?? 0;
  const last = upcoming[upcoming.length - 1]?.start ?? 0;
  // Default to the next two clients: the one in the chair now is usually already here.
  useOnChange(open, (isOpen) => isOpen && setUntil(upcoming[Math.min(1, upcoming.length - 1)]?.start ?? 0));

  const hit = upcoming.filter((a) => a.start <= until);
  const msg = (a: Appointment) =>
    `היי ${firstName(a.customerName)}, יש עיכוב של בערך ${delay} דק׳. התור שלך יתחיל ב-${fmtTime(a.start + delay)} במקום ${fmtTime(a.start)}. סליחה ותודה על הסבלנות!`;
  const queue = useSendQueue(hit.map((a) => ({ key: a.id, name: a.customerName, phone: a.phone, text: msg(a) })));
  const step = (dir: 1 | -1) => {
    // Move the "until" cursor to the next/previous appointment start.
    const starts = upcoming.map((a) => a.start);
    const idx = starts.findIndex((s) => s >= until);
    const cur = idx === -1 ? starts.length - 1 : starts[idx] === until ? idx : idx - 1;
    const next = Math.min(starts.length - 1, Math.max(0, cur + dir));
    setUntil(starts[next]);
  };

  const quick = [10, 20, 30, 45, 60];
  const cta =
    hit.length === 0
      ? 'אין למי לשלוח'
      : queue.sentCount === 0
        ? `שלח ל-${hit.length === 1 ? 'לקוח אחד' : `${hit.length} לקוחות`}`
        : queue.next
          ? `שלח ל${firstName(queue.next.name)} (${queue.sentCount + 1}/${queue.total})`
          : 'נשלח לכולם ✓';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="הודעת עיכוב"
      footer={
        <Button block variant="whatsapp" disabled={hit.length === 0} icon={<MessageCircle size={20} />} onClick={() => (queue.next ? queue.sendNext() : onClose())}>
          {cta}
        </Button>
      }
    >
      {upcoming.length === 0 ? (
        <p className="py-8 text-center text-ink-soft">אין עוד תורים היום.</p>
      ) : (
        <>
          <h2 className="m-0 pt-2 text-xl font-bold">בכמה אתה מתעכב?</h2>
          <div className="mt-2.5">
            <Stepper
              big
              value={
                <>
                  {delay}
                  <span className="text-[15px] font-medium text-ink-soft"> דק׳</span>
                </>
              }
              decLabel="פחות 5 דקות"
              incLabel="עוד 5 דקות"
              canDec={delay > 5}
              canInc={delay < 120}
              onDec={() => setDelay((d) => Math.max(5, d - 5))}
              onInc={() => setDelay((d) => Math.min(120, d + 5))}
            />
          </div>
          <div className="mt-2 flex gap-1.5">
            {quick.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={n === delay}
                onClick={() => setDelay(n)}
                className={cx('press h-10 flex-1 rounded-xl text-sm font-semibold', n === delay ? 'bg-brand text-brand-accent' : 'border border-line bg-white')}
              >
                {n === 60 ? 'שעה' : n}
              </button>
            ))}
          </div>

          <h2 className="m-0 mt-5 text-xl font-bold">לשלוח לתורים עד השעה</h2>
          <div className="mt-2.5">
            <Stepper
              big
              value={fmtTime(until)}
              decLabel="תור אחד פחות"
              incLabel="תור אחד יותר"
              canDec={until > first}
              canInc={until < last}
              onDec={() => step(-1)}
              onInc={() => step(1)}
            />
          </div>
          <div className="mt-2 flex gap-1.5">
            <button type="button" onClick={() => setUntil(first)} className="press h-10 flex-1 rounded-xl border border-line bg-white text-sm font-semibold">
              רק הלקוח הבא
            </button>
            <button type="button" onClick={() => setUntil(last)} className="press h-10 flex-1 rounded-xl border border-line bg-white text-sm font-semibold">
              עד סוף היום
            </button>
          </div>

          <div className="mt-3.5 rounded-2xl bg-surface px-3.5 py-0.5">
            {hit.map((a) => (
              <div key={a.id} className="flex h-10 items-center gap-2 text-sm">
                <span className="flex-1 font-medium">{a.customerName}</span>
                <span className="num text-ink-mute line-through">{fmtTime(a.start)}</span>
                <ArrowLeft size={14} className="text-ink-mute" />
                <span className="num font-bold">{fmtTime(a.start + delay)}</span>
                <button
                  type="button"
                  aria-label={`שלח ל${a.customerName}`}
                  onClick={() => queue.send({ key: a.id, name: a.customerName, phone: a.phone, text: msg(a) })}
                  className="press flex size-9 items-center justify-center rounded-full text-open-text"
                >
                  {queue.isSent(a.id) ? <Check size={18} /> : <MessageCircle size={18} />}
                </button>
              </div>
            ))}
          </div>
          {hit[0] && <Bubble className="mt-2.5 max-w-[320px] text-[13px]">{msg(hit[0])}</Bubble>}
        </>
      )}
    </Sheet>
  );
}

/** Edit or release a blocked slot. */
export function BlockSheet({ block, onClose }: { block: Block | null; onClose: () => void }) {
  const backend = useBackend();
  const db = useDb();
  const release = useReleaseBlock();
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(0);
  useOnChange(block, (b) => {
    if (b) {
      setFrom(b.start);
      setTo(b.end);
    }
  });
  const h = block ? hoursFor(db.settings, block.date) : null;
  return (
    <Sheet
      open={!!block}
      onClose={onClose}
      label="עריכת חסימה"
      footer={
        <div className="flex gap-2">
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => {
              release(block!);
              onClose();
            }}
          >
            שחרר
          </Button>
          <Button
            className="flex-[2]"
            onClick={async () => {
              await backend.blocks.update(block!.id, { from, to });
              onClose();
            }}
          >
            שמור {fmtRange(from, to)}
          </Button>
        </div>
      }
    >
      <SheetTitle>עריכת חסימה</SheetTitle>
      <div className="mt-4 flex flex-col gap-2.5">
        <Stepper
          label="מ-"
          value={fmtTime(from)}
          decLabel="מוקדם יותר"
          incLabel="מאוחר יותר"
          canDec={!!h && from > h.from}
          canInc={from + 15 < to}
          onDec={() => setFrom((v) => v - 15)}
          onInc={() => setFrom((v) => v + 15)}
        />
        <Stepper
          label="עד"
          value={fmtTime(to)}
          decLabel="מוקדם יותר"
          incLabel="מאוחר יותר"
          canDec={to - 15 > from}
          canInc={!!h && to < h.to}
          onDec={() => setTo((v) => v - 15)}
          onInc={() => setTo((v) => v + 15)}
        />
      </div>
    </Sheet>
  );
}

/** Admin cancels an appointment, optionally telling the client on WhatsApp. */
export function AdminCancelSheet({ appt, onClose }: { appt: Appointment | null; onClose: () => void }) {
  const backend = useBackend();
  const toast = useToast();
  const cancel = async (notify: boolean) => {
    const a = appt!;
    onClose();
    try {
      await backend.appointments.cancel(a.id);
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
      return;
    }
    haptic();
    if (notify && a.phone) {
      openExternal(
        whatsappUrl(a.phone, `היי ${firstName(a.customerName)}, נאלצתי לבטל את התור שלך ב${fmtShortDate(a.date)} ב-${fmtTime(a.start)}. סליחה! אפשר לקבוע מועד חדש באפליקציה.`),
      );
    }
    toast({ text: 'התור בוטל' });
  };
  return (
    <Sheet
      open={!!appt}
      onClose={onClose}
      label="ביטול תור"
      footer={
        <div className="flex flex-col gap-2">
          {appt?.phone && (
            <Button block variant="whatsapp" icon={<MessageCircle size={20} />} onClick={() => cancel(true)}>
              בטל ושלח הודעה ללקוח
            </Button>
          )}
          <Button block variant="danger" onClick={() => cancel(false)}>
            בטל בלי הודעה
          </Button>
          <Button block variant="ghost" size="md" onClick={onClose}>
            לא, השאר
          </Button>
        </div>
      }
    >
      <SheetTitle>לבטל את התור?</SheetTitle>
      {appt && (
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          {appt.customerName} • {appt.serviceName} • {fmtShortDate(appt.date)} ב-{fmtTime(appt.start)}
        </p>
      )}
    </Sheet>
  );
}

/** The admin's own calendar entry for an appointment: who, what, their number and notes, reminder 15 minutes before. */
export const adminCalendarEvent = (a: Appointment): CalendarEvent => ({
  title: `${a.customerName} - ${a.serviceName}`,
  date: a.date,
  start: a.start,
  end: a.end,
  location: SHOP.address,
  notes: [a.phone && `טלפון: ${formatPhone(a.phone)}`, a.notes && `הערות: ${a.notes}`].filter(Boolean).join('\n') || undefined,
  uid: a.id,
  alarmMin: 15,
});

/**
 * "כל התורים ליומן": every booked appointment from now on into the admin's own calendar, in one go.
 * Apple takes the file straight in; Google Calendar imports the same file (calendar.google.com > Import).
 * Each event keeps the appointment's id, so adding again later updates the ones already there.
 */
export function CalendarSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDb();
  const now = useNow();
  const today = todayKey(now);
  const nowM = nowMinutes(now);
  const list = db.appointments
    .filter((a) => a.status === 'booked' && (a.date > today || (a.date === today && a.end > nowM)))
    .sort((x, y) => x.date.localeCompare(y.date) || x.start - y.start);
  const events = () => list.map(adminCalendarEvent);
  const google = () => {
    downloadIcs(icsFile(events()), 'תורים.ics');
    if (!/android|iphone|ipad|ipod/i.test(navigator.userAgent)) openExternal('https://calendar.google.com/calendar/r/settings/export');
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="כל התורים ליומן"
      footer={
        list.length > 0 && (
          <div className="flex flex-col gap-2">
            <Button block icon={<CalendarPlus size={20} />} onClick={() => addToCalendar(events())}>
              יומן iPhone / Apple
            </Button>
            <Button block variant="secondary" icon={<CalendarPlus size={20} />} onClick={google}>
              יומן Google
            </Button>
          </div>
        )
      }
    >
      <SheetTitle>כל התורים ליומן</SheetTitle>
      {list.length === 0 ? (
        <p className="py-6 text-center text-ink-soft">אין תורים קבועים מהיום והלאה.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2 text-[15px] leading-relaxed text-ink-soft">
          <p className="m-0">
            {list.length === 1 ? 'התור הקבוע' : `${list.length} התורים הקבועים`} מהיום עד {fmtShortDate(list[list.length - 1].date)} ייכנסו ליומן שלך בבת אחת, עם שם הלקוח, הטלפון
            ותזכורת רבע שעה לפני.
          </p>
          <p className="m-0 text-sm">
            ביומן Google הקובץ נשמר, ובמחשב נפתח דף הייבוא של Google: בוחרים את הקובץ <bdi dir="ltr">תורים.ics</bdi> ולוחצים ייבוא. אם מוסיפים שוב בהמשך, תורים שכבר ביומן מתעדכנים
            ולא מוכפלים.
          </p>
        </div>
      )}
    </Sheet>
  );
}

/**
 * Makes one appointment longer or shorter. When that runs into (or frees time before) the appointments after it the
 * same day, asks whether to move them by the same amount.
 */
export function DurationSheet({ appt, onClose }: { appt: Appointment | null; onClose: () => void }) {
  const db = useDb();
  const backend = useBackend();
  const toast = useToast();
  const [minutes, setMinutes] = useState(30);
  const [busy, setBusy] = useState(false);
  useOnChange(appt?.id, () => appt && setMinutes(appt.end - appt.start));

  const delta = appt ? minutes - (appt.end - appt.start) : 0;
  const later = appt
    ? db.appointments.filter((a) => a.date === appt.date && a.status === 'booked' && a.id !== appt.id && a.start >= appt.end).sort((a, b) => a.start - b.start)
    : [];
  // Longer and the next one starts before the new end: they have to move (or the barber accepts the overlap).
  const clash = appt && later[0] && delta > 0 && later[0].start < appt.start + minutes;

  const save = async (shiftRest: boolean) => {
    if (!appt) return;
    setBusy(true);
    try {
      const end = appt.start + minutes;
      await backend.appointments.retime(appt.date, [
        { id: appt.id, start: appt.start, end },
        ...(shiftRest ? later.map((a) => ({ id: a.id, start: a.start + delta, end: a.end + delta })) : []),
      ]);
      haptic('success');
      toast({ text: shiftRest && later.length ? `התור עודכן, ו${later.length === 1 ? 'התור שאחריו זז' : `-${later.length} התורים שאחריו זזו`}` : 'משך התור עודכן' });
      onClose();
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const shiftLabel = `${delta > 0 ? 'לדחות' : 'להקדים'} את ${later.length === 1 ? 'התור שאחריו' : `${later.length} התורים שאחריו`} ב-${Math.abs(delta)} דק׳`;

  return (
    <Sheet
      open={!!appt}
      onClose={onClose}
      label="משך התור"
      footer={
        <div className="flex flex-col gap-2">
          {later.length > 0 && delta !== 0 && (
            <Button block disabled={busy} onClick={() => save(true)}>
              {shiftLabel}
            </Button>
          )}
          <Button block variant={later.length > 0 && delta !== 0 ? 'secondary' : 'primary'} disabled={busy || delta === 0} onClick={() => save(false)}>
            {later.length > 0 && delta !== 0 ? 'לשנות רק את התור הזה' : 'שמור'}
          </Button>
        </div>
      }
    >
      {appt && (
        <>
          <SheetTitle>כמה זמן ייקח התור?</SheetTitle>
          <p className="m-0 mt-1 text-sm text-ink-soft">
            {appt.customerName} • {appt.serviceName}
          </p>
          <div className="mt-4">
            <Stepper
              big
              value={
                <>
                  {minutes}
                  <span className="text-[15px] font-medium text-ink-soft"> דק׳</span>
                </>
              }
              decLabel="פחות 5 דקות"
              incLabel="עוד 5 דקות"
              canDec={minutes > 5}
              canInc={minutes < 240}
              onDec={() => setMinutes((m) => Math.max(5, m - 5))}
              onInc={() => setMinutes((m) => Math.min(240, m + 5))}
            />
          </div>
          <p className="m-0 mt-3 text-center text-[15px]">
            <span className="num font-semibold">{fmtRange(appt.start, appt.start + minutes)}</span>
          </p>
          {clash && (
            <p className="m-0 mt-2 text-center text-sm text-danger">
              נכנס לתור של {firstName(later[0].customerName)} ב-{fmtTime(later[0].start)}
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}
