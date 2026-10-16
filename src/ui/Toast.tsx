import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Portal } from './Overlay';
import { spring } from './motion';

interface ToastInput {
  text: string;
  action?: { label: string; run: () => void };
  tone?: 'default' | 'error';
}
type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<(t: ToastInput) => void>(() => {});
export const useToast = () => useContext(ToastContext);

/** Short status/undo messages floating above the tab bar (apple-design: forgiveness over confirmation). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const show = useCallback((t: ToastInput) => {
    const id = ++seq.current;
    setItems([{ ...t, id }]);
    setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== id)), t.action ? 5000 : 2800);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <Portal>
        <div aria-live="polite" className="pointer-events-none absolute inset-x-4 bottom-[104px] z-50 flex flex-col items-center gap-2">
          <AnimatePresence>
            {items.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={spring.ui}
                className={`pointer-events-auto flex min-h-12 items-center gap-3 rounded-2xl px-4 py-2 text-[15px] font-medium shadow-[0_8px_30px_rgba(28,25,23,0.22)] ${t.tone === 'error' ? 'bg-danger text-white' : 'bg-beitar-black text-white'}`}
              >
                <span>{t.text}</span>
                {t.action && (
                  <button
                    type="button"
                    className="press h-9 rounded-lg px-2 font-semibold text-beitar-yellow"
                    onClick={() => {
                      t.action!.run();
                      setItems([]);
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </Portal>
    </ToastContext.Provider>
  );
}
