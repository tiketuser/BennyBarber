import type { Transition } from 'motion/react';

// Spring presets (apple-design): critically damped by default, a little bounce only after momentum.
export const spring = {
  /** Default UI motion: no overshoot. */
  ui: { type: 'spring', bounce: 0, duration: 0.35 } as Transition,
  /** Sheets arriving / snapping back after a drag. */
  sheet: { type: 'spring', bounce: 0.12, duration: 0.42 } as Transition,
  /** Leaving: quick and clean. */
  exit: { type: 'spring', bounce: 0, duration: 0.28 } as Transition,
  /** Pushed screens. */
  push: { type: 'spring', bounce: 0, duration: 0.4 } as Transition,
};

/** Apple's momentum projection: where a flick would come to rest. */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}
