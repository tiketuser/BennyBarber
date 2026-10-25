import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { spring } from './motion';

/**
 * A screen pushed on top of a tab (RTL: enters from the left, leaves the same way).
 * Wrap usages in <AnimatePresence> so the exit runs along the same path it came in.
 */
export function Pushed({ children, className = 'bg-white', z = 20 }: { children: ReactNode; className?: string; z?: number }) {
  return (
    <motion.div
      className={`absolute inset-0 flex flex-col ${className}`}
      style={{ zIndex: z }}
      initial={{ x: '-100%', boxShadow: '0 0 0 rgba(0,0,0,0)' }}
      animate={{ x: 0, boxShadow: '8px 0 40px rgba(28,25,23,0.12)' }}
      exit={{ x: '-100%', boxShadow: '0 0 0 rgba(0,0,0,0)' }}
      transition={spring.push}
    >
      {children}
    </motion.div>
  );
}
