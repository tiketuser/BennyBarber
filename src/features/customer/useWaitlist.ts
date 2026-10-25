import { useState } from 'react';
import { useBackend, useDb, useSession } from '@/data/store';
import type { DateKey, DayPart } from '@/domain/types';
import { haptic } from '@/lib/platform';
import { useToast } from '@/ui/useToast';

/** Waitlist state for one day: the chosen part of day, my entry (if any), join and leave. */
export function useWaitlist(date: DateKey | null) {
  const backend = useBackend();
  const db = useDb();
  const session = useSession();
  const toast = useToast();
  const [part, setPart] = useState<DayPart>('any');
  const [joining, setJoining] = useState(false);
  const mine = date && session ? db.waitlist.find((w) => w.date === date && w.customerPhone === session.phone) : undefined;

  const join = async () => {
    if (!session || !date) return;
    setJoining(true);
    try {
      await backend.waitlist.join(date, part, session.name ?? '', session.phone);
      haptic('success');
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    } finally {
      setJoining(false);
    }
  };
  const leave = (id: string) => backend.waitlist.leave(id).catch((e: Error) => toast({ text: e.message, tone: 'error' }));

  return { part, setPart, mine, joining, join, leave };
}

export type WaitlistState = ReturnType<typeof useWaitlist>;
