import type { Minutes } from '@/domain/types';
import { cx } from '@/ui/cx';

/** How long an admin-added appointment runs: the service's own length, half an hour, an hour, or a custom from-to. */
export type LenChoice = 'service' | 30 | 60 | 'custom';

export function lenChoices(serviceMin: number): { id: LenChoice; label: string }[] {
  return [
    { id: 'service', label: `רגיל · ${serviceMin} דק׳` },
    { id: 30, label: 'חצי שעה' },
    { id: 60, label: 'שעה' },
    { id: 'custom', label: 'משעה עד שעה' },
  ];
}

export function lenMinutes(choice: LenChoice, serviceMin: number): number {
  return typeof choice === 'number' ? choice : serviceMin;
}

const toHHMM = (m: Minutes) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromHHMM = (v: string): Minutes | null => {
  const [h, m] = v.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

/** Native time pickers ("from" / "until"), so a phone shows its own wheel. */
export function FromTo({ from, to, onChange, className }: { from: Minutes; to: Minutes; onChange: (from: Minutes, to: Minutes) => void; className?: string }) {
  const field = (id: string, label: string, value: Minutes, set: (m: Minutes) => void) => (
    <label htmlFor={id} className="flex min-w-0 flex-1 flex-col gap-1.5 text-[13px] text-ink-soft">
      {label}
      <input
        id={id}
        type="time"
        step={300}
        dir="ltr"
        value={toHHMM(value)}
        onChange={(e) => {
          const m = fromHHMM(e.target.value);
          if (m != null) set(m);
        }}
        className="num h-12 w-full rounded-[14px] border border-line bg-white px-3 text-center text-base font-semibold text-ink outline-none focus:border-brand"
      />
    </label>
  );
  return (
    <div className={cx('flex gap-3', className)}>
      {field('appt-from', 'משעה', from, (m) => onChange(m, m + (to - from)))}
      {field('appt-to', 'עד שעה', to, (m) => onChange(from, m))}
    </div>
  );
}
