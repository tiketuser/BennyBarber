import type { ReactNode } from 'react';

/**
 * The app frame. Phones get the full screen. Wide screens get the desktop pages full width (`wide`),
 * or, for screens that only exist as a phone layout (login), a centered column on a soft backdrop.
 */
export function AppShell({ wide, children }: { wide: boolean; children: ReactNode }) {
  if (wide) return <div className="relative h-dvh w-full overflow-hidden bg-white">{children}</div>;
  return (
    <div className="h-dvh w-full bg-desk">
      <div className="relative mx-auto h-full w-full max-w-[480px] overflow-hidden bg-white md:border-x md:border-line">{children}</div>
    </div>
  );
}
