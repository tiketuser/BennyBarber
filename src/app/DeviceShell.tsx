import { useEffect, useState, type ReactNode } from 'react';
import { Monitor, RotateCcw, Smartphone } from 'lucide-react';
import { useBackend, useSession } from '@/data/store';
import { cx } from '@/ui/controls';

function useDesktop() {
  const q = '(min-width: 768px)';
  const [desktop, setDesktop] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setDesktop(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return desktop;
}

/**
 * Phones: the app is full-bleed (100dvh, no horizontal overflow).
 * Desktop: the app sits in a phone frame, with a demo toolbar to switch customer/admin and frame/full view.
 */
export function DeviceShell({ children }: { children: ReactNode }) {
  const desktop = useDesktop();
  const backend = useBackend();
  const session = useSession();
  const [framed, setFramed] = useState(true);
  const devSwitch = (role: 'customer' | 'admin') => {
    backend.dev?.switchRole(role);
    window.dispatchEvent(new Event('bb:dev-switch'));
  };

  if (!desktop) {
    return <div className="relative h-dvh w-full overflow-x-hidden overflow-y-hidden">{children}</div>;
  }

  const seg = (on: boolean) => cx('press flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors', on ? 'bg-beitar-black text-beitar-yellow' : 'text-ink-soft');

  return (
    <div className="flex h-dvh flex-col items-center bg-[#EFEDE9]">
      <div className="z-50 mt-4 flex flex-wrap items-center justify-center gap-2">
        {backend.dev && (
          <div className="flex gap-1 rounded-full bg-white p-1 shadow-sm">
            <button type="button" className={seg(session?.role !== 'admin')} onClick={() => devSwitch('customer')}>
              תצוגת לקוח
            </button>
            <button type="button" className={seg(session?.role === 'admin')} onClick={() => devSwitch('admin')}>
              תצוגת אדמין
            </button>
          </div>
        )}
        <div className="flex gap-1 rounded-full bg-white p-1 shadow-sm">
          <button type="button" className={seg(framed)} onClick={() => setFramed(true)}>
            <Smartphone size={15} /> מסגרת טלפון
          </button>
          <button type="button" className={seg(!framed)} onClick={() => setFramed(false)}>
            <Monitor size={15} /> תצוגה מלאה
          </button>
        </div>
        {backend.dev && (
          <button
            type="button"
            title="איפוס נתוני הדמו"
            className="press flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold text-ink-soft shadow-sm"
            onClick={() => backend.dev!.reset()}
          >
            <RotateCcw size={15} /> איפוס נתונים
          </button>
        )}
      </div>
      <div
        className={cx(
          'relative my-4 w-full overflow-hidden bg-white',
          framed ? 'max-h-[900px] max-w-[430px] flex-1 rounded-[44px] shadow-[0_30px_80px_rgba(28,25,23,0.18),0_0_0_10px_#1C1917]' : 'flex-1',
        )}
        style={{ transform: 'translateZ(0)' }}
      >
        {children}
      </div>
    </div>
  );
}
