import { useState } from 'react';
import { CalendarDays, History, Settings2, Zap } from 'lucide-react';
import type { DateKey, Minutes } from '@/domain/types';
import { todayKey } from '@/lib/time';
import { TabBar, type TabItem } from '@/ui/TabBar';
import { DayView } from './DayView';
import { HistoryTab } from './HistoryTab';
import { QuickSheet } from './QuickSheet';
import { SettingsTab } from './SettingsTab';

type Tab = 'day' | 'quick' | 'settings' | 'history';

const TABS: TabItem<Tab>[] = [
  { id: 'day', label: 'יומן', icon: <CalendarDays size={24} /> },
  { id: 'quick', label: 'תור מהיר', icon: <Zap size={24} /> },
  { id: 'settings', label: 'שירותים ושעות', icon: <Settings2 size={24} /> },
  { id: 'history', label: 'היסטוריה', icon: <History size={24} /> },
];

/** Admin app, built for one-handed use between haircuts. "תור מהיר" opens a sheet over the current tab. */
export function AdminApp() {
  const [tab, setTab] = useState<Exclude<Tab, 'quick'>>('day');
  const [date, setDate] = useState<DateKey>(() => todayKey());
  const [quick, setQuick] = useState<{ open: boolean; start: Minutes | null }>({ open: false, start: null });
  const openQuick = (start: Minutes | null) => setQuick({ open: true, start });

  return (
    <div className="relative h-full overflow-hidden bg-white">
      {tab === 'day' && <DayView date={date} setDate={setDate} onQuick={openQuick} />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'history' && <HistoryTab />}
      <TabBar
        label="ניווט אדמין"
        items={TABS}
        active={quick.open ? 'quick' : tab}
        onSelect={(t) => {
          if (t === 'quick') {
            setDate(todayKey());
            openQuick(null);
          } else setTab(t);
        }}
      />
      <QuickSheet open={quick.open} onClose={() => setQuick((q) => ({ ...q, open: false }))} date={date} start={quick.start} />
    </div>
  );
}
