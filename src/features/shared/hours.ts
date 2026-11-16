import type { Settings, Weekday } from '@/domain/types';
import { DAY_LETTERS, fmtRange } from '@/lib/time';

/** Groups consecutive weekdays with identical hours: "א׳ - ה׳ 09:00 - 20:00". */
export function groupHours(settings: Settings) {
  const rows: { days: Weekday[]; label: string; value: string; open: boolean }[] = [];
  for (let d = 0 as Weekday; d <= 6; d = (d + 1) as Weekday) {
    const h = settings.hours[d];
    const value = h.open ? fmtRange(h.from, h.to) : 'סגור';
    const last = rows[rows.length - 1];
    if (last && last.value === value && last.days[last.days.length - 1] === d - 1) last.days.push(d);
    else rows.push({ days: [d], label: '', value, open: h.open });
  }
  for (const r of rows) {
    const a = r.days[0];
    const b = r.days[r.days.length - 1];
    r.label = a === b ? (a === 6 ? 'שבת' : DAY_LETTERS[a]) : `${DAY_LETTERS[a]} - ${DAY_LETTERS[b]}`;
  }
  return rows;
}
