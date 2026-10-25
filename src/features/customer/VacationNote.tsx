import { Palmtree } from 'lucide-react';
import { useDb, useNow } from '@/data/store';
import { backFrom, upcomingVacation, vacationText } from '@/domain/schedule';
import { fmtDayMonthRange, fmtShortDate, todayKey } from '@/lib/time';
import { cx } from '@/ui/cx';

/** A vacation now or within two weeks: when it is and when he's back, so customers aren't left wondering. */
export function VacationNote({ className = 'mx-4 mt-3' }: { className?: string }) {
  const db = useDb();
  const today = todayKey(useNow());
  const v = upcomingVacation(db.settings, today);
  if (!v) return null;
  const back = backFrom(db.settings, v);
  const text = v.from <= today ? vacationText(db.settings, v) : `חופשה ב-${fmtDayMonthRange(v.from, v.to)}` + (back ? `. חוזרים ב${fmtShortDate(back)}` : '');
  return (
    <div role="note" className={cx('flex items-center gap-3 rounded-[18px] bg-surface px-4 py-3 text-sm', className)}>
      <Palmtree size={20} className="shrink-0" />
      <span className="leading-snug">{text}</span>
    </div>
  );
}
