import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { X } from 'lucide-react';
import { Portal } from './Overlay';
import { project, spring } from './motion';
import { useIsDesktop } from './useIsDesktop';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name of the dialog. */
  label: string;
  children: ReactNode;
  /** Sticky area at the bottom (primary action). */
  footer?: ReactNode;
  /** Called once the close animation has finished. */
  onExited?: () => void;
}

/**
 * Native-style bottom sheet on phones. Drag the grabber down to dismiss: it follows the finger 1:1,
 * and on release the flick velocity is projected forward to decide close vs. snap back.
 * On desktop the same content opens as a side panel on the left edge, like the desktop design.
 */
export function Sheet({ open, onClose, label, children, footer, onExited }: SheetProps) {
  return (
    <Portal>
      <AnimatePresence onExitComplete={onExited}>
        {open && (
          <SheetPanel key="sheet" onClose={onClose} label={label} footer={footer}>
            {children}
          </SheetPanel>
        )}
      </AnimatePresence>
    </Portal>
  );
}

function SheetPanel({ onClose, label, children, footer }: Omit<SheetProps, 'open' | 'onExited'>) {
  const controls = useDragControls();
  const panel = useRef<HTMLElement>(null);
  const desktop = useIsDesktop();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, []);

  const scrim = (
    <motion.div
      aria-hidden
      className="absolute inset-0 bg-[rgba(28,25,23,0.32)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
    />
  );

  if (desktop)
    return (
      <div className="absolute inset-0">
        {scrim}
        <motion.section
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          className="absolute bottom-0 left-0 top-0 flex w-[460px] max-w-full flex-col rounded-r-3xl bg-white shadow-[12px_0_48px_rgba(28,25,23,0.22)] outline-none"
          initial={{ x: '-100%' }}
          animate={{ x: 0, transition: spring.sheet }}
          exit={{ x: '-100%', transition: spring.exit }}
        >
          <div className="flex shrink-0 justify-end px-4 pt-4">
            <button
              type="button"
              aria-label="סגור"
              onClick={onClose}
              className="flex size-10 items-center justify-center rounded-full text-ink-soft hover:bg-surface hover:text-ink"
            >
              <X size={20} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-7 pb-4">{children}</div>
          {footer && <div className="shrink-0 px-7 pb-7 pt-2">{footer}</div>}
        </motion.section>
      </div>
    );

  return (
    <div className="absolute inset-0">
      {scrim}
      <motion.section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[94%] flex-col rounded-t-sheet bg-white shadow-[0_-12px_40px_rgba(28,25,23,0.18)] outline-none"
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: spring.sheet }}
        exit={{ y: '100%', transition: spring.exit }}
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 1 }}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 40 }}
        onDragEnd={(_, info) => {
          const h = panel.current?.offsetHeight ?? 600;
          const restingPoint = info.offset.y + project(info.velocity.y);
          if (restingPoint > h * 0.4) onClose();
        }}
      >
        <div className="flex shrink-0 cursor-grab touch-none justify-center pb-2 pt-2.5 active:cursor-grabbing" onPointerDown={(e) => controls.start(e)}>
          <span aria-hidden className="h-[5px] w-10 rounded-full bg-line-strong" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="shrink-0 px-5 pt-2 pb-bar-lg">{footer}</div>}
      </motion.section>
    </div>
  );
}

/** Sheet title row with an optional note on the left. */
export function SheetTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 pt-2">
      <h2 className="m-0 text-[22px] font-bold tracking-display">{children}</h2>
      {aside && <span className="text-[13px] text-ink-soft">{aside}</span>}
    </div>
  );
}
