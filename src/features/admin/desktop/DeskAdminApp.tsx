import { useState, type ReactNode } from 'react';
import { CalendarDays, History, LogOut, Palmtree, Settings2, Zap } from 'lucide-react';
import { useBackend } from '@/data/store';
import type { DateKey, Minutes } from '@/domain/types';
import { SHOP } from '@/config/shop';
import { todayKey } from '@/lib/time';
import { cx } from '@/ui/cx';
import { DayView } from '../DayView';
import { HistoryTab } from '../HistoryTab';
import { SettingsTab } from '../SettingsTab';
import { DeskQuick } from './DeskQuick';
import { DeskVacation } from './DeskVacation';
import { ShopMark } from '@/ui/ShopMark';

type Tab = 'day' | 'quick' | 'settings' | 'history' | 'vacation';

/** Admin dashboard for wide screens: side menu with the same four tabs (plus vacations), each a full page. */
export function DeskAdminApp() {
  const backend = useBackend();
  const [tab, setTab] = useState<Tab>('day');
  const [date, setDate] = useState<DateKey>(() => todayKey());
  // Each visit to "תור מהיר" starts fresh, from the slot it was opened for.
  const [quick, setQuick] = useState<{ key: number; date: DateKey; start: Minutes | null }>({ key: 0, date: todayKey(), start: null });
  const openQuick = (start: Minutes | null, from: DateKey = date) => {
    setQuick((q) => ({ key: q.key + 1, date: from, start }));
    setTab('quick');
  };

  const items: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'day', label: 'יומן', icon: <CalendarDays size={20} /> },
    { id: 'quick', label: 'תור מהיר', icon: <Zap size={20} /> },
    { id: 'settings', label: 'שירותים ושעות', icon: <Settings2 size={20} /> },
    { id: 'history', label: 'היסטוריה', icon: <History size={20} /> },
  ];
  const sideItem = 'flex h-[46px] w-full items-center gap-3 rounded-xl px-3.5 text-[15px] transition-colors';

  return (
    <div className="flex h-full">
      <aside className="flex w-[248px] shrink-0 flex-col gap-1.5 border-l border-line-soft bg-surface px-4 py-6">
        <div className="flex items-center gap-2.5 px-2 pb-[22px]">
          <span className="flex size-10 items-center justify-center rounded-full bg-brand text-brand-accent">
            <ShopMark size={18} />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-brand text-xl leading-none">{SHOP.brand}</span>
            <span className="text-xs text-ink-mute">ניהול {SHOP.place}</span>
          </div>
        </div>
        <nav aria-label="ניווט אדמין" className="flex flex-col gap-1">
          {items.map((it) => {
            const on = it.id === tab;
            return (
              <button
                key={it.id}
                type="button"
                aria-current={on ? 'page' : undefined}
                onClick={() => (it.id === 'quick' ? openQuick(null, todayKey()) : setTab(it.id))}
                className={cx(sideItem, on ? 'bg-brand font-semibold text-white' : 'font-medium text-ink-soft hover:bg-white hover:text-ink')}
              >
                {it.icon}
                {it.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <button
            type="button"
            aria-current={tab === 'vacation' ? 'page' : undefined}
            onClick={() => setTab('vacation')}
            className={cx(sideItem, tab === 'vacation' ? 'bg-brand font-semibold text-white' : 'font-medium text-ink-soft hover:bg-white hover:text-ink')}
          >
            <Palmtree size={20} />
            ימי חופש
          </button>
          <button type="button" onClick={() => backend.auth.signOut()} className={cx(sideItem, 'font-medium text-ink-soft hover:bg-white hover:text-ink')}>
            <LogOut size={20} />
            התנתקות
          </button>
        </div>
      </aside>

      <main className="relative min-w-0 flex-1 overflow-y-auto px-8 pb-12 pt-7">
        {tab === 'day' && <DayView layout="desk" date={date} setDate={setDate} onQuick={openQuick} />}
        {tab === 'quick' && <DeskQuick key={quick.key} initialDate={quick.date} initialStart={quick.start} />}
        {tab === 'settings' && <SettingsTab layout="desk" onVacations={() => setTab('vacation')} />}
        {tab === 'history' && <HistoryTab layout="desk" />}
        {tab === 'vacation' && <DeskVacation />}
      </main>
    </div>
  );
}
