import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, CalendarDays, Navigation, RotateCcw, X } from 'lucide-react';
import { useBackend, useDb } from '@/data/store';
import { PART_LABELS } from '@/domain/schedule';
import type { Appointment } from '@/domain/types';
import { SHOP } from '@/config/shop';
import { haptic, openExternal } from '@/lib/platform';
import { DAY_LETTERS, fmtDayShortMonth, fmtShortDate, fmtTime, fromKey, MONTHS_SHORT, weekdayOf } from '@/lib/time';
import { Button } from '@/ui/controls';
import { ConfirmSheet } from '@/ui/ConfirmSheet';
import { TAB_BAR_SPACE } from '@/ui/TabBar';
import { useToast } from '@/ui/useToast';
import { spring } from '@/ui/motion';
import { appointmentPrice } from '../format';
import { useMyAppointments } from './hooks';

interface Props {
  onReschedule: (a: Appointment) => void;
  onBookAgain: (serviceId: string) => void;
  onBookNew: () => void;
}

/** Tab 2: upcoming (navigate / reschedule / cancel), waitlist entries, past with "הזמן שוב". */
export function MyAppointments({ onReschedule, onBookAgain, onBookNew }: Props) {
  const backend = useBackend();
  const db = useDb();
  const toast = useToast();
  const { upcoming, past, waitlist } = useMyAppointments();
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const leaveWaitlist = (id: string) => backend.waitlist.leave(id).catch((e: Error) => toast({ text: e.message, tone: 'error' }));
  const isPriceHidden = (a: Appointment) => !!db.services.find((s) => s.id === a.serviceId)?.priceHidden;

  return (
    <div className="absolute inset-0 overflow-y-auto pt-safe" style={{ paddingBottom: TAB_BAR_SPACE }}>
      <h1 className="m-0 px-5 pb-4 pt-6 text-[28px] font-bold tracking-display">התורים שלי</h1>

      {upcoming.length === 0 && waitlist.length === 0 && (
        <div className="mx-4 flex flex-col items-center gap-3 rounded-[20px] bg-surface px-6 py-8 text-center">
          <CalendarDays size={32} className="text-ink-soft" />
          <span className="text-[17px] font-semibold">אין לך תורים קרובים</span>
          <Button size="md" onClick={onBookNew}>
            לקביעת תור
          </Button>
        </div>
      )}

      {upcoming.length > 0 && <div className="px-5 pb-2.5 text-sm font-semibold text-ink-soft">{upcoming.length > 1 ? 'הבאים בתור' : 'הבא בתור'}</div>}
      <div className="flex flex-col gap-3 px-4">
        <AnimatePresence initial={false}>
          {upcoming.map((a) => (
            <motion.article
              key={a.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: -12 }}
              transition={spring.ui}
              className="overflow-hidden rounded-[20px] border border-line"
            >
              <div className="flex items-center gap-3.5 p-4">
                <div className="flex h-[60px] w-14 flex-col items-center justify-center rounded-[14px] bg-brand leading-tight text-brand-accent">
                  <span className="text-[11px] font-medium">{MONTHS_SHORT[fromKey(a.date).getMonth()]}</span>
                  <span className="text-[22px] font-bold">{fromKey(a.date).getDate()}</span>
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="text-[17px] font-semibold">
                    יום {DAY_LETTERS[weekdayOf(a.date)]} • {fmtTime(a.start)}
                  </div>
                  <div className="text-sm text-ink-soft">
                    {a.serviceName}
                    {isPriceHidden(a) ? '' : ` • ${appointmentPrice(a, db.services)}`}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 border-t border-line">
                <button type="button" onClick={() => openExternal(SHOP.wazeUrl)} className="press flex h-[52px] items-center justify-center gap-1.5 text-sm font-medium">
                  <Navigation size={18} />
                  ניווט
                </button>
                <button type="button" onClick={() => onReschedule(a)} className="press flex h-[52px] items-center justify-center gap-1.5 border-x border-line text-sm font-medium">
                  <RotateCcw size={18} />
                  שינוי מועד
                </button>
                <button type="button" onClick={() => setCancelling(a)} className="press flex h-[52px] items-center justify-center gap-1.5 text-sm font-medium text-danger">
                  <X size={18} />
                  ביטול
                </button>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>

      {waitlist.length > 0 && (
        <>
          <div className="px-5 pb-2.5 pt-7 text-sm font-semibold text-ink-soft">ברשימת המתנה</div>
          <div className="flex flex-col gap-2 px-4">
            {waitlist.map((w) => (
              <div key={w.id} className="flex min-h-[68px] items-center gap-3 rounded-2xl border border-open-line bg-open-soft pe-3 ps-4">
                <Bell size={20} className="text-open-text" />
                <div className="flex flex-1 flex-col gap-[3px]">
                  <span className="text-[15px] font-medium">{fmtShortDate(w.date)}</span>
                  <span className="text-[13px] text-ink-soft">{PART_LABELS[w.part]} • נודיע בוואטסאפ אם יתפנה</span>
                </div>
                <button type="button" onClick={() => leaveWaitlist(w.id)} className="press h-11 rounded-xl px-3 text-sm font-semibold text-ink-soft">
                  יציאה
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <div className="px-5 pb-2.5 pt-7 text-sm font-semibold text-ink-soft">היו כבר</div>
          <div className="flex flex-col gap-2 px-4 pb-6">
            {past.slice(0, 12).map((a) => (
              <div key={a.id} className="flex h-[68px] items-center gap-3 rounded-2xl bg-surface pe-3 ps-4">
                <div className="flex flex-1 flex-col gap-[3px]">
                  <span className="text-[15px] font-medium">{a.serviceName}</span>
                  <span className="text-[13px] text-ink-soft">
                    {fmtDayShortMonth(a.date)} • {fmtTime(a.start)}
                  </span>
                </div>
                {db.services.some((s) => s.id === a.serviceId) && (
                  <button type="button" onClick={() => onBookAgain(a.serviceId)} className="press h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold">
                    הזמן שוב
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <ConfirmSheet
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title="לבטל את התור?"
        confirmLabel="כן, לבטל"
        onConfirm={async () => {
          const a = cancelling!;
          setCancelling(null);
          try {
            await backend.appointments.cancel(a.id);
            haptic();
            toast({ text: 'התור בוטל' });
          } catch (e) {
            toast({ text: (e as Error).message, tone: 'error' });
          }
        }}
      >
        {cancelling && `${cancelling.serviceName}, ${fmtShortDate(cancelling.date)} ב-${fmtTime(cancelling.start)}. אם תרצה, אפשר במקום זה לשנות מועד.`}
      </ConfirmSheet>
    </div>
  );
}
