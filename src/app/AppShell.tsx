import type { ReactNode } from 'react';

/**
 * The app frame. Phones get the full screen; on wider screens the same app is a centered column,
 * so every sheet, tab bar and floating button stays where a thumb expects it.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh w-full bg-desk">
      <div className="relative mx-auto h-full w-full max-w-[480px] overflow-hidden bg-white md:border-x md:border-line">{children}</div>
    </div>
  );
}
