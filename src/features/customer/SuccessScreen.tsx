import { motion } from 'motion/react';
import { CalendarCheck, MessageCircle, Scissors } from 'lucide-react';
import type { Appointment } from '@/domain/types';
import { SHOP } from '@/config/shop';
import { whatsappUrl } from '@/lib/links';
import { addToCalendar, openExternal } from '@/lib/platform';
import { DAY_LETTERS, fmtDayShortMonth, fmtShortDate, fmtTime, weekdayOf } from '@/lib/time';
import { Button } from '@/ui/controls';
import { spring } from '@/ui/motion';
import { useDb } from '@/data/store';
import { customerPrice } from '../format';

/** Step 4: the digital ticket. */
export function SuccessScreen({ appt, onHome }: { appt: Appointment; onHome: () => void }) {
  const db = useDb();
  const service = db.services.find((s) => s.id === appt.serviceId);
  const price = service ? customerPrice(service) : '';
  const when = `${fmtShortDate(appt.date)} ב-${fmtTime(appt.start)}`;

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto bg-surface pt-safe">
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0.45, duration: 0.6, delay: 0.1 }}
        className="mt-14 flex size-[72px] shrink-0 items-center justify-center rounded-full bg-open text-white shadow-[0_0_0_10px_rgba(5,150,105,0.12)]"
      >
        <motion.svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <motion.path d="M20 6 9 17l-5-5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.35, ease: 'easeOut' }} />
        </motion.svg>
      </motion.div>
      <h1 className="m-0 mt-[22px] text-[28px] font-bold tracking-display">נתראה במספרה!</h1>
      <p className="m-0 mt-1.5 text-[15px] text-ink-soft">התור שלך נקבע.</p>

      <motion.article
        aria-label="כרטיס התור"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...spring.sheet, delay: 0.2 }}
        className="mt-7 w-[calc(100%-48px)] max-w-[342px] shrink-0 overflow-hidden rounded-[22px] bg-white shadow-[0_8px_30px_rgba(28,25,23,0.08)]"
      >
        <div className="flex items-center justify-between bg-beitar-black px-5 py-[18px] text-white">
          <div className="flex flex-col gap-0.5">
            <span className="font-brand text-2xl leading-tight text-beitar-yellow">{SHOP.brand}</span>
            <span className="text-xs text-line-strong">ברברשופ • {SHOP.address}</span>
          </div>
          <Scissors size={26} className="text-beitar-yellow" />
        </div>
        <div className="grid grid-cols-2 gap-4 p-5">
          {[
            ['יום', `${DAY_LETTERS[weekdayOf(appt.date)]}, ${fmtDayShortMonth(appt.date)}`],
            ['שעה', fmtTime(appt.start)],
            ['טיפול', appt.serviceName],
            ['מחיר', price],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-[3px]">
              <span className="text-xs text-ink-soft">{k}</span>
              <span className="text-[17px] font-semibold">{v}</span>
            </div>
          ))}
        </div>
        <div aria-hidden className="relative h-5">
          <span className="absolute -right-2.5 top-0 size-5 rounded-full bg-surface" />
          <span className="absolute inset-x-4 top-[9px] border-t-2 border-dashed border-line" />
          <span className="absolute -left-2.5 top-0 size-5 rounded-full bg-surface" />
        </div>
        <div className="flex items-center justify-between px-5 pb-[18px] pt-2.5 text-sm">
          <span className="text-ink-soft">על שם</span>
          <span className="font-semibold">{appt.customerName}</span>
        </div>
      </motion.article>

      <div className="mt-auto flex w-full flex-col gap-2.5 px-4 pt-6 pb-bar-lg">
        <Button
          variant="whatsapp"
          icon={<MessageCircle size={20} />}
          onClick={() => openExternal(whatsappUrl(SHOP.phone, `היי, קבעתי תור ל${appt.serviceName}, ${when}. שם: ${appt.customerName}`))}
        >
          שלח אישור לוואטסאפ
        </Button>
        <Button
          variant="secondary"
          icon={<CalendarCheck size={20} />}
          onClick={() =>
            addToCalendar({ title: `${appt.serviceName} - ${SHOP.fullName}`, date: appt.date, start: appt.start, end: appt.end, location: SHOP.address, notes: appt.notes })
          }
        >
          הוסף ליומן
        </Button>
        <button type="button" onClick={onHome} className="h-11 text-[15px] font-medium text-ink-soft">
          חזרה לדף הבית
        </button>
      </div>
      <span className="sr-only" role="status">
        התור נקבע ל{when}
      </span>
    </div>
  );
}
