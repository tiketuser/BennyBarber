import { useLayoutEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { Check, ChevronLeft, Loader2 } from 'lucide-react';
import { haptic } from '@/lib/platform';
import { project } from './motion';

const THUMB = 52;
const INSET = 4;

interface Props {
  label: string;
  doneLabel: string;
  /** Resolve to keep the success state, reject to slide back. */
  onConfirm: () => Promise<unknown>;
  disabled?: boolean;
}

/**
 * Slide-to-confirm (RTL: thumb starts on the right, slides left).
 * Tracks the finger 1:1; on release, momentum is projected so a quick flick also confirms.
 * Keyboard: focus and press Enter/Space.
 */
export function SlideToConfirm({ label, doneLabel, onConfirm, disabled }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [max, setMax] = useState(290);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const x = useMotionValue(0);
  const fill = useTransform(x, (v) => (v < 0 ? -v + THUMB + INSET * 2 : 0));
  const labelOpacity = useTransform(x, [0, -max * 0.6], [1, 0]);

  useLayoutEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => setMax(el.offsetWidth - THUMB - INSET * 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const commit = async () => {
    if (state !== 'idle' || disabled) return;
    setState('busy');
    animate(x, -max, { type: 'spring', bounce: 0, duration: 0.3 });
    try {
      await onConfirm();
      haptic('success');
      setState('done');
    } catch {
      haptic('warning');
      setState('idle');
      animate(x, 0, { type: 'spring', bounce: 0.12, duration: 0.42 });
    }
  };

  const done = state === 'done';
  return (
    <div
      ref={track}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={`${label}. אפשר גם ללחוץ Enter`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          commit();
        }
      }}
      className={`relative h-[60px] select-none overflow-hidden rounded-full transition-colors duration-300 ${done ? 'bg-open' : 'bg-surface'} ${disabled ? 'opacity-40' : ''}`}
    >
      <motion.div aria-hidden className={`absolute inset-y-0 right-0 rounded-full ${done ? 'bg-open' : 'bg-brand'}`} style={{ width: fill }} />
      <motion.div
        aria-hidden
        style={{ opacity: done ? 0 : labelOpacity }}
        className="pointer-events-none absolute inset-0 flex items-center justify-center pr-10 text-base font-semibold text-ink"
      >
        {label}
      </motion.div>
      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-[17px] font-semibold text-white transition-[opacity,transform] duration-300 ${done ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`}
      >
        <Check size={20} strokeWidth={3} aria-hidden />
        {doneLabel}
      </div>
      <motion.div
        aria-hidden
        className={`absolute right-1 top-1 flex size-[52px] cursor-grab touch-none items-center justify-center rounded-full bg-brand text-brand-accent shadow-[0_2px_8px_rgba(17,17,17,0.25)] transition-opacity active:cursor-grabbing ${done ? 'opacity-0' : ''}`}
        style={{ x }}
        drag="x"
        dragListener={!disabled && state === 'idle'}
        dragConstraints={{ left: -max, right: 0 }}
        dragElastic={0.02}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          const resting = x.get() + project(info.velocity.x, 0.99);
          if (resting < -max * 0.7) commit();
          else animate(x, 0, { type: 'spring', bounce: 0.12, duration: 0.42, velocity: info.velocity.x });
        }}
      >
        {state === 'busy' ? <Loader2 size={24} className="animate-spin" /> : <ChevronLeft size={26} strokeWidth={2.5} />}
      </motion.div>
    </div>
  );
}
