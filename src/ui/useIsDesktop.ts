import { useSyncExternalStore } from 'react';

/** Matches Tailwind's `lg`: from here the app switches from the phone layout to the desktop pages. */
const QUERY = '(min-width: 1024px)';

const subscribe = (onChange: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};

export function useIsDesktop() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches);
}
