import { Bell, MessageCircle, X } from 'lucide-react';
import { useBackend, useDb } from '@/data/store';
import { PART_LABELS } from '@/domain/schedule';
import type { DateKey } from '@/domain/types';
import { whatsappUrl } from '@/lib/links';
import { openExternal } from '@/lib/platform';
import { DAY_LETTERS, fmtShortDate, fromKey, weekdayOf } from '@/lib/time';
import { cx } from '@/ui/cx';
import { useToast } from '@/ui/useToast';
import { firstName } from '../format';

/** "ממתינים": who is on the waitlist for this day (WhatsApp or remove), and which other days have people waiting. */
export function WaitlistPanel({ date, today, setDate, className = 'mx-4 mt-4' }: { date: DateKey; today: DateKey; setDate: (d: DateKey) => void; className?: string }) {
  const backend = useBackend();
  const db = useDb();
  const toast = useToast();
  const here = db.waitlist.filter((w) => w.date === date).sort((a, b) => a.createdAt - b.createdAt);
  const otherDays = [...new Set(db.waitlist.filter((w) => w.date >= today && w.date !== date).map((w) => w.date))].sort();
  if (!here.length && !otherDays.length) return null;

  const when = date === today ? 'היום' : `ב${fmtShortDate(date)}`;
  return (
    <section aria-labelledby="h-waitlist" className={cx('flex flex-col gap-2.5 rounded-[20px] border border-line p-4', className)}>
      <h2 id="h-waitlist" className="m-0 flex items-center gap-2 text-base font-bold">
        <Bell size={18} />
        {here.length ? `${here.length} ממתינים ${when}` : 'רשימת המתנה'}
      </h2>
      {here.map((w) => (
        <div key={w.id} className="flex min-h-12 items-center gap-2 rounded-xl bg-surface pe-1.5 ps-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">{w.name || w.phone}</span>
            <span className="text-xs text-ink-soft">{w.part === 'any' ? 'כל שעה' : PART_LABELS[w.part]}</span>
          </div>
          {w.phone && (
            <button
              type="button"
              aria-label={`וואטסאפ ל${w.name}`}
              onClick={() => openExternal(whatsappUrl(w.phone, `היי ${firstName(w.name)}, יש לי מקום ${when}. מתאים לך?`))}
              className="press flex size-9 items-center justify-center rounded-[10px] bg-open text-white"
            >
              <MessageCircle size={17} />
            </button>
          )}
          <button
            type="button"
            aria-label={`הסר את ${w.name} מרשימת ההמתנה`}
            onClick={() => backend.waitlist.leave(w.id).catch((e: Error) => toast({ text: e.message, tone: 'error' }))}
            className="press flex size-9 items-center justify-center rounded-[10px] text-ink-soft"
          >
            <X size={17} />
          </button>
        </div>
      ))}
      {otherDays.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <span className="text-ink-soft">{here.length ? 'ממתינים גם ב:' : 'יש ממתינים ב:'}</span>
          {otherDays.slice(0, 8).map((d) => (
            <button key={d} type="button" onClick={() => setDate(d)} className="press h-8 rounded-full border border-line px-2.5 font-semibold">
              {DAY_LETTERS[weekdayOf(d)]} {fromKey(d).getDate()}/{fromKey(d).getMonth() + 1} · {db.waitlist.filter((w) => w.date === d).length}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
