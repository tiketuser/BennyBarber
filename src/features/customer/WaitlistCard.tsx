import { AnimatePresence, motion } from 'motion/react';
import { Bell, Check } from 'lucide-react';
import { PART_LABELS } from '@/domain/schedule';
import type { DateKey, DayPart } from '@/domain/types';
import { DAY_LETTERS, fmtShortDate, weekdayOf } from '@/lib/time';
import { cx } from '@/ui/cx';
import { spring } from '@/ui/motion';
import type { WaitlistState } from './useWaitlist';
import { g } from '@/config/shop';

/** A full day: pick when it would suit you, or see that you're already on the list. */
export function WaitlistCard({ date, waitlist, className = 'mx-4 mt-5' }: { date: DateKey; waitlist: WaitlistState; className?: string }) {
  const { mine, part, setPart, leave } = waitlist;
  return (
    <AnimatePresence mode="wait" initial={false}>
      {mine ? (
        <motion.section
          key="joined"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={spring.ui}
          className={cx('flex flex-col items-center gap-2.5 rounded-[22px] border border-open-line bg-open-soft px-5 py-6 text-center', className)}
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-open text-white">
            <Check size={28} strokeWidth={2.5} />
          </span>
          <span className="text-xl font-bold">{g('אתה ברשימת ההמתנה', 'את ברשימת ההמתנה', 'אתם ברשימת ההמתנה')}</span>
          <span className="text-[15px] leading-normal">
            {fmtShortDate(date)} • {mine.part === 'any' ? 'כל שעה' : 'ב' + PART_LABELS[mine.part]}
            <br />
            ברגע שמתפנה תור נשלח לך הודעה בוואטסאפ. מי שעונה ראשון תופס.
          </span>
          <button type="button" onClick={() => leave(mine.id)} className="h-11 text-sm font-semibold text-ink-soft underline">
            {g('צא מהרשימה', 'צאי מהרשימה', 'צאו מהרשימה')}
          </button>
        </motion.section>
      ) : (
        <motion.section key="join" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cx('flex flex-col gap-3.5 rounded-[22px] bg-surface p-5', className)}>
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white">
              <Bell size={20} />
            </span>
            <div className="flex flex-col gap-[3px]">
              <span className="text-lg font-bold">יום {DAY_LETTERS[weekdayOf(date)]} מלא לגמרי</span>
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
                className={cx('press h-12 rounded-[14px] text-[15px] font-semibold', p === part ? 'bg-brand text-brand-accent' : 'border border-line bg-white')}
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
