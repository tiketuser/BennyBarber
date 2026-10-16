import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Backend } from './backend';
import type { DbSnapshot, Session } from '@/domain/types';

const BackendContext = createContext<Backend | null>(null);

export function BackendProvider({ backend, children }: { backend: Backend; children: ReactNode }) {
  return <BackendContext.Provider value={backend}>{children}</BackendContext.Provider>;
}

export function useBackend(): Backend {
  const b = useContext(BackendContext);
  if (!b) throw new Error('BackendProvider missing');
  return b;
}

/** The live shared state. Re-renders whenever the backend publishes a new snapshot. */
export function useDb(): DbSnapshot {
  const b = useBackend();
  return useSyncExternalStore(b.subscribe, b.getSnapshot);
}

export function useSession(): Session | null {
  const b = useBackend();
  return useSyncExternalStore(b.auth.subscribe, b.auth.getSession);
}

/** Current time that ticks every 30s, so "פתוח עכשיו", the now-marker and past slots stay fresh. */
export function useNow(intervalMs = 30000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
