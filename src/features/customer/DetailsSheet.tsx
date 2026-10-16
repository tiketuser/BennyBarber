import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useBackend, useSession } from '@/data/store';
import type { Appointment, DateKey, Minutes, Service } from '@/domain/types';
import { isValidMobile, formatPhone } from '@/lib/phone';
import { fmtShortDate, fmtTime } from '@/lib/time';
import { Field, PhoneInput, TextInput } from '@/ui/controls';
import { Sheet } from '@/ui/Sheet';
import { SlideToConfirm } from '@/ui/SlideToConfirm';
import { useToast } from '@/ui/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  service: Service;
  date: DateKey;
  start: Minutes;
  replacesId?: string;
  /** Fires after the sheet has slid away, so the ticket screen takes over cleanly. */
  onBooked: (a: Appointment) => void;
}

/** Step 3: details prefilled from the saved profile, optional haircut notes, slide to confirm. */
export function DetailsSheet({ open, onClose, service, date, start, replacesId, onBooked }: Props) {
  const backend = useBackend();
  const session = useSession();
  const toast = useToast();
  const [name, setName] = useState(session?.name ?? '');
  const [phone, setPhone] = useState(formatPhone(session?.phone ?? ''));
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState<Appointment | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDone(null);
      setLeaving(false);
      setName(session?.name ?? '');
      setPhone(formatPhone(session?.phone ?? ''));
    }
  }, [open, session]);

  const valid = name.trim().length >= 2 && isValidMobile(phone);

  const confirm = async () => {
    try {
      const appt = await backend.appointments.book({ serviceId: service.id, date, start, customerName: name, phone, notes, replacesId });
      setDone(appt);
      // Let the success state show, then slide away; the parent learns about it once we're gone.
      setTimeout(() => setLeaving(true), 650);
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
      throw e;
    }
  };

  return (
    <Sheet
      open={open && !leaving}
      onClose={onClose}
      onExited={() => {
        if (done) {
          onBooked(done);
          setDone(null);
        }
      }}
      label="פרטים ואישור"
      footer={
        <div className="flex flex-col gap-2.5">
          <SlideToConfirm label="החלק לאישור" doneLabel="התור נקבע!" onConfirm={confirm} disabled={!valid} />
          <div className="text-center text-xs text-ink-soft">התשלום במספרה, אין צורך בכרטיס אשראי</div>
        </div>
      }
    >
      <div className="flex items-baseline justify-between pt-2">
        <h1 className="m-0 text-2xl font-bold tracking-display">כמעט סיימנו</h1>
        <span className="text-[13px] text-ink-soft">שלב 3 מתוך 3</span>
      </div>

      <dl className="m-0 mt-4 flex flex-col gap-2.5 rounded-2xl bg-surface px-4 py-3.5 text-[15px]">
        {[
          ['טיפול', service.name],
          ['מתי', `${fmtShortDate(date)} • ${fmtTime(start)}`],
          ['משך', `${service.durationMin} דק׳`],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <dt className="text-ink-soft">{k}</dt>
            <dd className="m-0 font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex flex-col gap-4">
        <Field id="bname" label="שם מלא">
          <TextInput id="bname" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="btel" label="מספר נייד">
          <PhoneInput id="btel" value={phone} onChange={setPhone} />
        </Field>
        <Field
          id="bnotes"
          label={
            <>
              הערות לתספורת <span className="font-normal text-ink-soft">(לא חובה)</span>
            </>
          }
        >
          <textarea
            id="bnotes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="למשל: קצר בצדדים, להשאיר אורך למעלה"
            className="h-[76px] w-full resize-none rounded-[14px] border border-line bg-white px-4 py-3 text-base outline-none focus:border-2 focus:border-beitar-black"
          />
        </Field>
        <div className="flex items-center gap-2 text-[13px] text-ink-soft">
          <MessageCircle size={16} className="text-open" />
          נשלח לך תזכורת בוואטסאפ יום לפני התור
        </div>
      </div>
    </Sheet>
  );
}
