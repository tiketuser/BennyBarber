import { useEffect, useRef, useState } from 'react';
import { LogOut, Scissors, UserRound } from 'lucide-react';
import { useBackend, useSession } from '@/data/store';
import type { Appointment } from '@/domain/types';
import { SHOP } from '@/config/shop';
import { cx } from '@/ui/cx';
import { useOpenStatus } from '../hooks';
import { DeskBook } from './DeskBook';
import { DeskMine } from './DeskMine';
import { DeskShop, type ShopSection } from './DeskShop';

type Page = 'book' | 'shop' | 'mine';

const NAV: { label: string; page: Page; section?: ShopSection }[] = [
  { label: 'קביעת תור', page: 'book' },
  { label: 'המספרה', page: 'shop' },
  { label: 'גלריה', page: 'shop', section: 'gallery' },
  ...(SHOP.course ? [{ label: 'קורס ספרות', page: 'shop' as const, section: 'course' as const }] : []),
  { label: 'התורים שלי', page: 'mine' },
];

/** What the next visit to the booking page starts from: a fresh booking, "book again", or a reschedule. */
interface BookStart {
  key: number;
  serviceId?: string;
  replacing?: Appointment;
}

/** Customer website for wide screens: top navigation, booking on one page, shop page, my appointments. */
export function DeskCustomerApp() {
  const backend = useBackend();
  const session = useSession();
  const status = useOpenStatus();
  const [page, setPage] = useState<Page>('book');
  const [section, setSection] = useState<ShopSection | null>(null);
  const [bookStart, setBookStart] = useState<BookStart>({ key: 0 });
  const scroller = useRef<HTMLDivElement>(null);

  const go = (p: Page, s: ShopSection | null = null) => {
    setPage(p);
    setSection(s);
  };
  const startBooking = (start: Omit<BookStart, 'key'> = {}) => {
    setBookStart((b) => ({ ...start, key: b.key + 1 }));
    go('book');
  };

  // A section link scrolls to it; a plain page change starts at the top.
  useEffect(() => {
    // Scroll only our own container: scrollIntoView would also shift the fixed app shell when the
    // section sits near the end of the page, leaving the layout stuck half off-screen.
    const box = scroller.current;
    const el = section && document.getElementById(section);
    if (!box) return;
    if (!el) {
      // Not `return box.scrollTo(...)`: newer browsers return a promise there, and React would call it as cleanup.
      box.scrollTo({ top: 0 });
      return;
    }
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 96;
    box.scrollTo({ top, behavior: 'smooth' });
  }, [page, section]);

  return (
    <div ref={scroller} className="h-full overflow-y-auto">
      <header className="sticky top-0 z-10 border-b border-line-soft bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1240px] items-center gap-6 px-8">
          <button type="button" onClick={() => go('book')} className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-brand text-brand-accent">
              <Scissors size={20} />
            </span>
            <span className="font-brand text-[26px] leading-none">{SHOP.brand}</span>
          </button>
          <nav aria-label="ניווט ראשי" className="flex gap-1">
            {NAV.map((n) => {
              const on = n.page === page && !n.section && !(page === 'shop' && section);
              return (
                <button
                  key={n.label}
                  type="button"
                  aria-current={on ? 'page' : undefined}
                  onClick={() => (n.page === 'book' ? startBooking() : go(n.page, n.section))}
                  className={cx(
                    'flex h-10 items-center rounded-full px-3.5 text-[15px] transition-colors hover:bg-surface hover:text-ink',
                    on ? 'bg-surface font-semibold text-ink' : 'font-medium text-ink-soft',
                  )}
                >
                  {n.label}
                </button>
              );
            })}
          </nav>
          <div className="mr-auto flex items-center gap-2.5">
            <span
              className={cx(
                'flex h-[34px] items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold',
                status.open ? 'bg-open-soft text-open-text' : 'bg-surface text-ink-soft',
              )}
            >
              <span className={cx('size-2 rounded-full', status.open ? 'bg-open-dot' : 'bg-ink-faint')} />
              {status.open ? `פתוח עד ${status.closesAt}` : status.text}
            </span>
            <button
              type="button"
              onClick={() => go('mine')}
              className="flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold hover:border-line-strong"
            >
              <UserRound size={18} />
              {session?.name}
            </button>
            <button
              type="button"
              aria-label="התנתקות"
              title="התנתקות"
              onClick={() => backend.auth.signOut()}
              className="flex size-10 items-center justify-center rounded-full text-ink-soft hover:bg-surface hover:text-ink"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {page === 'book' && (
        <DeskBook key={bookStart.key} initialServiceId={bookStart.serviceId} replacing={bookStart.replacing} onCancelReplace={() => startBooking()} onOpenMine={() => go('mine')} />
      )}
      {page === 'shop' && <DeskShop onBook={() => startBooking()} />}
      {page === 'mine' && (
        <DeskMine
          onReschedule={(a) => startBooking({ serviceId: a.serviceId, replacing: a })}
          onBookAgain={(id) => startBooking({ serviceId: id })}
          onBookNew={() => startBooking()}
        />
      )}
    </div>
  );
}
