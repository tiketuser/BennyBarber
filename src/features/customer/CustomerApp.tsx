import { useCallback, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { CalendarDays, List, MapPin } from 'lucide-react';
import { useDb } from '@/data/store';
import type { Appointment, DateKey, Minutes } from '@/domain/types';
import { Pushed } from '@/ui/Pushed';
import { TabBar, type TabItem } from '@/ui/TabBar';
import { BookHome } from './BookHome';
import { DetailsSheet } from './DetailsSheet';
import { MyAppointments } from './MyAppointments';
import { CourseScreen, GalleryScreen, ShopScreen } from './ShopScreens';
import { SuccessScreen } from './SuccessScreen';
import { TimeScreen } from './TimeScreen';

type Tab = 'book' | 'mine' | 'shop';

const TABS: TabItem<Tab>[] = [
  { id: 'book', label: 'קביעת תור', icon: <CalendarDays size={24} /> },
  { id: 'mine', label: 'התורים שלי', icon: <List size={24} /> },
  { id: 'shop', label: 'המספרה', icon: <MapPin size={24} /> },
];

interface Draft {
  serviceId: string | null;
  date: DateKey | null;
  start: Minutes | null;
  replacesId?: string;
}

const EMPTY: Draft = { serviceId: null, date: null, start: null };

/** Customer app: tab bar + booking flow (service → time → details sheet → ticket). */
export function CustomerApp() {
  const db = useDb();
  const [tab, setTab] = useState<Tab>('book');
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [timeOpen, setTimeOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [booked, setBooked] = useState<Appointment | null>(null);
  const [shopPage, setShopPage] = useState<null | 'gallery' | 'course'>(null);

  const service = db.services.find((s) => s.id === draft.serviceId) ?? null;
  const pick = useCallback((date: DateKey, start: Minutes | null) => setDraft((d) => ({ ...d, date, start })), []);

  const startFlow = (serviceId: string, replacesId?: string) => {
    setDraft({ serviceId, date: null, start: null, replacesId });
    setTab('book');
    setTimeOpen(true);
  };

  const finish = () => {
    setBooked(null);
    setTimeOpen(false);
    setDraft(EMPTY);
    setTab('book');
  };

  return (
    <div className="relative h-full overflow-hidden bg-white">
      {tab === 'book' && (
        <BookHome
          serviceId={draft.serviceId}
          onSelectService={(id) => setDraft((d) => ({ ...d, serviceId: id }))}
          onNext={() => setTimeOpen(true)}
          onOpenMine={() => setTab('mine')}
        />
      )}
      {tab === 'mine' && <MyAppointments onReschedule={(a) => startFlow(a.serviceId, a.id)} onBookAgain={(id) => startFlow(id)} onBookNew={() => setTab('book')} />}
      {tab === 'shop' && <ShopScreen onGallery={() => setShopPage('gallery')} onCourse={() => setShopPage('course')} />}

      <TabBar
        label="ניווט ראשי"
        items={TABS}
        active={tab}
        onSelect={(t) => {
          setTab(t);
          setShopPage(null);
        }}
      />

      <AnimatePresence>
        {timeOpen && service && (
          <Pushed key="time">
            <TimeScreen
              service={service}
              date={draft.date}
              start={draft.start}
              onPick={pick}
              rescheduling={!!draft.replacesId}
              hold={detailsOpen || !!booked}
              onBack={() => {
                setTimeOpen(false);
                if (draft.replacesId) setDraft(EMPTY);
              }}
              onContinue={() => setDetailsOpen(true)}
            />
          </Pushed>
        )}
        {/* Under the tab bar (z-10), so the tabs stay on the gallery. */}
        {shopPage === 'gallery' && (
          <Pushed key="gallery" z={5}>
            <GalleryScreen onBack={() => setShopPage(null)} />
          </Pushed>
        )}
        {shopPage === 'course' && (
          <Pushed key="course">
            <CourseScreen onBack={() => setShopPage(null)} />
          </Pushed>
        )}
        {booked && (
          <Pushed key="success" z={30} className="bg-surface">
            <SuccessScreen appt={booked} onHome={finish} />
          </Pushed>
        )}
      </AnimatePresence>

      {service && draft.date && draft.start != null && (
        <DetailsSheet
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          service={service}
          date={draft.date}
          start={draft.start}
          replacesId={draft.replacesId}
          onBooked={(a) => {
            setBooked(a);
            setDetailsOpen(false);
          }}
        />
      )}
    </div>
  );
}
