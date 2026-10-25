import type { ReactNode } from 'react';
import { cx } from './cx';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon: ReactNode;
}

/** Fixed bottom tab bar on a translucent material; content scrolls underneath. */
export function TabBar<T extends string>({ items, active, onSelect, label }: { items: TabItem<T>[]; active: T; onSelect: (id: T) => void; label: string }) {
  return (
    <nav aria-label={label} className="glass absolute inset-x-0 bottom-0 z-10 flex border-t border-line-soft px-2 pt-2 pb-bar-lg">
      {items.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            aria-current={on ? 'page' : undefined}
            onClick={() => onSelect(t.id)}
            className={cx('press flex min-h-12 flex-1 flex-col items-center justify-center gap-1 text-[11px]', on ? 'font-semibold text-brand' : 'font-medium text-ink-soft')}
          >
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

/** Height of the tab bar, for bottom padding of scroll areas and sticky CTAs. */
export const TAB_BAR_SPACE = 'calc(64px + max(20px, env(safe-area-inset-bottom)))';
