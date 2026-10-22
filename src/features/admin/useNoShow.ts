import type { Appointment } from '@/domain/types';
import { useBackend } from '@/data/store';
import { haptic } from '@/lib/platform';
import { useToast } from '@/ui/useToast';

/** Takes off the day a client who didn't come, with undo. */
export function useNoShow() {
  const backend = useBackend();
  const toast = useToast();
  return async (a: Appointment) => {
    try {
      await backend.appointments.setNoShow(a.id, true);
      haptic();
      toast({ text: `${a.customerName} סומן שלא הגיע`, action: { label: 'ביטול', run: () => backend.appointments.setNoShow(a.id, false) } });
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    }
  };
}
