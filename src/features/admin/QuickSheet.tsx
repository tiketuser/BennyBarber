import { useState } from 'react';
import { Plus, Zap } from 'lucide-react';
import { useBackend, useDb } from '@/data/store';
import { clashes, freeGaps, hoursFor, nextFreeStart } from '@/domain/schedule';
import type { DateKey, Minutes } from '@/domain/types';
import { haptic } from '@/lib/platform';
import { formatPhone } from '@/lib/phone';
import { fmtRange, fmtTime, nowMinutes, todayKey } from '@/lib/time';
import { Button, Chip, TextInput } from '@/ui/controls';
import { Sheet } from '@/ui/Sheet';
import { useOnChange } from '@/ui/useOnChange';
import { useToast } from '@/ui/useToast';
import { money } from '../format';
import { SHOP } from '@/config/shop';
import { FromTo, lenChoices, lenMinutes, type LenChoice } from './apptLength';

/** Walk-in in two taps, or block 30 / 60 minutes / until closing. */
export function QuickSheet({ open, onClose, date, start }: { open: boolean; onClose: () => void; date: DateKey; start: Minutes | null }) {
  const backend = useBackend();
  const db = useDb();
  const toast = useToast();
  const services = [...db.services].sort((a, b) => a.order - b.order);
  const [picked, setPicked] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [len, setLen] = useState<LenChoice>('service');
  const [custom, setCustom] = useState<{ from: Minutes; to: Minutes } | null>(null);
  useOnChange(open, (isOpen) => {
    if (!isOpen) return;
    setName('');
    setPhone('');
    setLen('service');
    setCustom(null);
  });

  const hours = hoursFor(db.settings, date);
  const isToday = date === todayKey();
  // "Now", rounded to 5 minutes and kept inside opening hours: where "דחוף תור עכשיו" goes.
  const nowStart = isToday && hours ? Math.min(Math.max(Math.ceil(nowMinutes() / 5) * 5, hours.from), hours.to - 5) : null;
  // Any free time at all (20 minutes is the shortest window), not just room for the first service.
  // A full day still opens the form: the barber can squeeze someone in.
  const from = start ?? nextFreeStart(db, date, 20) ?? nowStart ?? hours?.from ?? null;
  const gap = from == null ? undefined : freeGaps(db, date, 20).find((g) => from >= g.from && from < g.to);
  const room = gap ? gap.to - from! : 0;
  // Picked service, else the first one that fits the free time here, else the first one.
  const service = services.find((s) => s.id === picked) ?? services.find((s) => s.durationMin <= room) ?? services[0];
  const serviceMin = service?.durationMin ?? 20;
  const length = lenMinutes(len, serviceMin);
  // A longer choice looks for the first window it fits in; if none, the clash message explains.
  const apptFrom = start ?? nextFreeStart(db, date, length) ?? from;
  // The custom range starts where the quick one would, until the barber moves it.
  const range = from == null ? null : len === 'custom' ? (custom ?? { from: apptFrom!, to: apptFrom! + serviceMin }) : { from: apptFrom!, to: apptFrom! + length };

  // The time runs into another appointment: adding it squeezes the client in.
  const squeeze = !!range && clashes(db, date, range.from, range.to);

  const addWalkIn = async (at = range, force = squeeze) => {
    if (!at || !service) return;
    const range = at;
    try {
      const a = await backend.appointments.addWalkIn({ serviceId: service.id, date, start: range.from, end: range.to, customerName: name, phone, squeeze: force });
      haptic('success');
      onClose();
      toast({
        text: `נוסף ליומן ${fmtRange(range.from, range.to)}`,
        action: {
          label: 'ביטול',
          run: async () => {
            await backend.appointments.cancel(a.id);
            await backend.appointments.markOpeningHandled(a.id);
          },
        },
      });
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    }
  };

  const block = async (len: number | 'end') => {
    if (from == null || !hours) return;
    const end = len === 'end' ? hours.to : Math.min(hours.to, from + len);
    try {
      const b = await backend.blocks.add(date, from, end, 'חסום');
      haptic();
      onClose();
      toast({ text: `נחסם ${fmtRange(from, end)}`, action: { label: 'ביטול', run: () => backend.blocks.remove(b.id) } });
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    }
  };

  return (
    <Sheet open={open} onClose={onClose} label="תור מהיר או חסימה">
      {from == null || !hours ? (
        <div className="py-8 text-center">
          <h2 className="m-0 text-xl font-bold">{hours ? 'אין זמן פנוי ביום הזה' : `${SHOP.closed} ביום הזה`}</h2>
          <p className="text-ink-soft">אפשר לעבור ליום אחר ביומן.</p>
        </div>
      ) : (
        <>
          <h2 className="m-0 pt-2 text-[22px] font-bold">{isToday && start == null ? 'לקוח נכנס עכשיו' : 'הוספת לקוח'}</h2>
          <div className="mt-3.5 flex flex-wrap gap-2">
            {services.map((s) => (
              <Chip key={s.id} on={s.id === service?.id} onClick={() => setPicked(s.id)}>
                {s.shortName} {money(s.price)}
              </Chip>
            ))}
          </div>
          <span className="mt-3.5 block text-[13px] text-ink-soft">כמה זמן</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {lenChoices(serviceMin).map((c) => (
              <Chip key={c.id} on={c.id === len} onClick={() => setLen(c.id)}>
                {c.label}
              </Chip>
            ))}
          </div>
          {len === 'custom' && range && <FromTo className="mt-3" from={range.from} to={range.to} onChange={(f, t) => setCustom({ from: f, to: t })} />}
          <label htmlFor="walkin" className="mt-3.5 block text-[13px] text-ink-soft">
            שם (לא חובה)
          </label>
          <TextInput id="walkin" placeholder="למשל: רון" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-12" />
          <label htmlFor="walkin-phone" className="mt-3 block text-[13px] text-ink-soft">
            טלפון (לא חובה)
          </label>
          <TextInput
            id="walkin-phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            dir="ltr"
            placeholder="05X-XXXXXXX"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            className="mt-1.5 h-12 text-right"
          />
          {squeeze && <p className="m-0 mt-3.5 text-[13px] text-danger">יש כבר תור בזמן הזה. הלקוח יידחף ביניהם, והתורים האחרים נשארים במקום.</p>}
          <Button block className="mt-3.5" icon={<Plus size={20} />} onClick={() => addWalkIn()} disabled={!service || !range || range.to <= range.from}>
            <span className="num">
              {squeeze ? 'דחוף תור' : 'הוסף ליומן'} {range && fmtRange(range.from, range.to)}
            </span>
          </Button>
          {nowStart != null && range?.from !== nowStart && (
            <Button
              block
              variant="secondary"
              className="mt-2"
              icon={<Zap size={18} />}
              onClick={() => addWalkIn({ from: nowStart, to: nowStart + (len === 'custom' ? serviceMin : length) }, true)}
              disabled={!service}
            >
              דחוף תור עכשיו ({fmtTime(nowStart)})
            </Button>
          )}

          <div aria-hidden className="mt-6 border-t border-line-soft" />

          <h2 className="m-0 mt-5 text-[22px] font-bold">לחסום זמן</h2>
          <p className="m-0 mt-1 text-[13px] text-ink-soft">לקוחות לא יוכלו לקבוע בזמן הזה. החל מ-{fmtTime(from)}.</p>
          <div className="mt-3.5 grid grid-cols-3 gap-2 pb-2">
            {(
              [
                [30, '30 דק׳'],
                [60, 'שעה'],
                ['end', 'עד הסוף'],
              ] as const
            ).map(([len, label]) => (
              <Button key={label} variant="danger" size="lg" className="text-base" onClick={() => block(len)}>
                {label}
              </Button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
