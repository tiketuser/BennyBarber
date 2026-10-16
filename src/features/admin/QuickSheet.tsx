import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useBackend, useDb } from '@/data/store';
import { hoursFor, nextFreeStart } from '@/domain/schedule';
import type { DateKey, Minutes } from '@/domain/types';
import { haptic } from '@/lib/platform';
import { fmtTime, todayKey } from '@/lib/time';
import { Button, Chip, TextInput } from '@/ui/controls';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { money } from '../format';

/** Walk-in in two taps, or block 30 / 60 minutes / until closing. */
export function QuickSheet({ open, onClose, date, start }: { open: boolean; onClose: () => void; date: DateKey; start: Minutes | null }) {
  const backend = useBackend();
  const db = useDb();
  const toast = useToast();
  const services = [...db.services].sort((a, b) => a.order - b.order);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      if (!services.some((s) => s.id === serviceId)) setServiceId(services[0]?.id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const hours = hoursFor(db.settings, date);
  const from = start ?? nextFreeStart(db, date, 20);
  const isToday = date === todayKey();

  const addWalkIn = async () => {
    if (from == null) return;
    try {
      const a = await backend.appointments.addWalkIn({ serviceId, date, start: from, customerName: name });
      haptic('success');
      onClose();
      toast({
        text: `נוסף ליומן ב-${fmtTime(from)}`,
        action: {
          label: 'ביטול',
          run: async () => {
            await backend.appointments.cancel(a.id, 'admin');
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
    const b = await backend.blocks.add(date, from, end, 'חסום');
    haptic();
    onClose();
    toast({ text: `נחסם ${fmtTime(from)} - ${fmtTime(end)}`, action: { label: 'ביטול', run: () => backend.blocks.remove(b.id) } });
  };

  return (
    <Sheet open={open} onClose={onClose} label="תור מהיר או חסימה">
      {from == null || !hours ? (
        <div className="py-8 text-center">
          <h2 className="m-0 text-xl font-bold">{hours ? 'אין זמן פנוי ביום הזה' : 'המספרה סגורה ביום הזה'}</h2>
          <p className="text-ink-soft">אפשר לעבור ליום אחר ביומן.</p>
        </div>
      ) : (
        <>
          <h2 className="m-0 pt-2 text-[22px] font-bold">{isToday && start == null ? 'לקוח נכנס עכשיו' : 'הוספת לקוח'}</h2>
          <div className="mt-3.5 flex flex-wrap gap-2">
            {services.map((s) => (
              <Chip key={s.id} on={s.id === serviceId} onClick={() => setServiceId(s.id)}>
                {s.shortName} {money(s.price)}
              </Chip>
            ))}
          </div>
          <label htmlFor="walkin" className="mt-3.5 block text-[13px] text-ink-soft">
            שם (לא חובה)
          </label>
          <TextInput id="walkin" placeholder="למשל: רון" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-12" />
          <Button block className="mt-3.5" icon={<Plus size={20} />} onClick={addWalkIn} disabled={!serviceId}>
            הוסף ליומן מ-{fmtTime(from)}
          </Button>

          <div aria-hidden className="mt-6 border-t border-line-soft" />

          <h2 className="m-0 mt-5 text-[22px] font-bold">לחסום זמן</h2>
          <p className="m-0 mt-1 text-[13px] text-ink-soft">לקוחות לא יוכלו לקבוע בזמן הזה. החל מ-{fmtTime(from)}.</p>
          <div className="mt-3.5 grid grid-cols-3 gap-2 pb-2">
            {([
              [30, '30 דק׳'],
              [60, 'שעה'],
              ['end', 'עד הסוף'],
            ] as const).map(([len, label]) => (
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
