import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Sheets and toasts render into the app frame (not <body>), so they stay inside the app column on wide screens.
const HostContext = createContext<HTMLElement | null>(null);

export function OverlayHost({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  return (
    <HostContext.Provider value={host}>
      {children}
      <div ref={setHost} className="pointer-events-none absolute inset-0 z-40 [&>*]:pointer-events-auto" />
    </HostContext.Provider>
  );
}

export function Portal({ children }: { children: ReactNode }) {
  const host = useContext(HostContext);
  return host ? createPortal(children, host) : null;
}
