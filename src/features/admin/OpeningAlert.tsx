import { motion } from 'motion/react';
import { Bell, Check, MessageCircle, X } from 'lucide-react';
import { useBackend, useDb, useNow } from '@/data/store';
import { PART_LABELS, partOf } from '@/domain/schedule';
import type { Appointment } from '@/domain/types';
import { fmtAgo, fmtShortDate, fmtTime, nowMinutes, todayKey } from '@/lib/time';
import { Bubble } from '@/ui/controls';
import { cx } from '@/ui/cx';
import { spring } from '@/ui/motion';
import { money } from '../format';
import { waitingFor } from './openings';
import { useSendQueue } from './useSendQueue';

/** "התפנה תור": one-tap WhatsApp to everyone waiting, first come first served. */
export function OpeningAlert({ appt }: { appt: Appointment }) {
  const backend = useBackend();
  const db = useDb();
  const now = useNow();
  const waiting = waitingFor(db, appt);
  const isToday = appt.date === todayKey(now);
  const when = isToday ? 'היום' : `ב${fmtShortDate(appt.date)}`;
  // If the freed slot already started, offer it from the next 5 minutes.
  const from = isToday ? Math.max(appt.start, Math.ceil(nowMinutes(now) / 5) * 5) : appt.start;
  const text = `היי אחי, התפנה לי תור ${when} ב-${fmtTime(from)}, רוצה לתפוס אותו?`;
  const queue = useSendQueue(waiting.map((w) => ({ key: w.id, name: w.name, phone: w.phone, text })));
  const part = partOf(from);

  return (
    <motion.section layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={spring.ui} aria-live="polite" className="mx-4 mt-4 overflow-hidden">
      <div className="flex flex-col gap-3 rounded-[20px] bg-beitar-black p-4 text-white">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-beitar-yellow text-beitar-black">
            <Bell size={20} />
          </span>
          <div className="flex flex-1 flex-col gap-[3px]">
            <span className="text-lg font-bold">
              התפנה תור {isToday ? '' : when + ' '}ב-{fmtTime(from)}
            </span>
            <span className="text-[13px] text-line-strong">
              {appt.customerName} ביטל {fmtAgo(appt.cancelledAt ?? Date.now())} • תור של {money(appt.price)}
            </span>
          </div>
          <button type="button" aria-label="סגור התראה" onClick={() => backend.appointments.markOpeningHandled(appt.id)} className="press -me-1 flex size-10 items-center justify-center rounded-full text-line-strong">
            <X size={18} />
          </button>
        </div>
        <Bubble>{text}</Bubble>
        <button
          type="button"
          onClick={() => queue.sendNext()}
          disabled={!queue.next}
          className="press flex h-12 items-center justify-center gap-2 rounded-[14px] bg-open text-[15px] font-semibold text-white disabled:opacity-70"
        >
          <MessageCircle size={18} />
          {!queue.next
            ? `נשלח לכל ה-${queue.total} ✓`
            : queue.sentCount === 0
              ? waiting.length === 1
                ? `שלח ל${waiting[0].name}`
                : `שלח לכל ה-${waiting.length}`
              : `שלח לבא בתור (${queue.sentCount + 1}/${queue.total})`}
        </button>
      </div>

      <div className="flex items-baseline justify-between px-1 pb-2 pt-4">
        <span className="text-[15px] font-bold">ממתינים {part === 'morning' ? 'לבוקר' : part === 'noon' ? 'לצהריים' : 'לערב'}</span>
        <span className="text-[13px] text-ink-soft">{waiting.length === 1 ? 'אדם אחד' : `${waiting.length} אנשים`}</span>
      </div>
      <div className="flex flex-col gap-2">
        {waiting.map((w, i) => {
          const sent = queue.isSent(w.id);
          return (
            <div key={w.id} className="flex h-[68px] items-center gap-2.5 rounded-2xl border border-line pe-2.5 ps-3.5">
              <span className="flex size-7 items-center justify-center rounded-full bg-surface text-[13px] font-bold">{i + 1}</span>
              <div className="flex flex-1 flex-col gap-[3px]">
                <span className="text-[15px] font-semibold">{w.name}</span>
                <span className="text-xs text-ink-soft">
                  נרשם {fmtAgo(w.createdAt, now.getTime())} • {PART_LABELS[w.part]}
                </span>
              </div>
              <button
                type="button"
                aria-label={sent ? `נשלח ל${w.name}` : `שלח וואטסאפ ל${w.name}`}
                onClick={() => queue.send({ key: w.id, name: w.name, phone: w.phone, text })}
                className={cx('press flex h-11 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold', sent ? 'bg-surface text-open-text' : 'bg-open text-white')}
              >
                {sent ? (
                  <>
                    נשלח <Check size={16} />
                  </>
                ) : (
                  'שלח'
                )}
              </button>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
