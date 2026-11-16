import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Share, X } from 'lucide-react';
import { SHOP, g } from '@/config/shop';
import { isIOS, isStandalone } from '@/lib/platform';
import { Button } from '@/ui/controls';
import { Sheet, SheetTitle } from '@/ui/Sheet';
import { spring } from '@/ui/motion';
import { useLogoUrl } from '@/ui/useLogoUrl';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
});

const KEY = 'bb.install.dismissed';
/** A closed banner comes back after a week (older versions stored '1': that counts as long ago). */
const QUIET_MS = 7 * 24 * 60 * 60 * 1000;

/** Dismissible "add to home screen" prompt. Uses the real install prompt on Android/Chrome, instructions on iPhone. */
export function InstallBanner() {
  const [show, setShow] = useState(false);
  const [help, setHelp] = useState(false);
  const logoUrl = useLogoUrl();

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = Date.now() - Number(localStorage.getItem(KEY) ?? 0) < QUIET_MS;
    } catch {
      /* ignore */
    }
    if (!dismissed && !isStandalone()) {
      const t = setTimeout(() => setShow(true), 900);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      if (outcome === 'accepted') dismiss();
    } else setHelp(true);
  };

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.aside
            key="install"
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={spring.ui}
            className="mx-4 overflow-hidden"
          >
            <div className="flex items-center gap-3 rounded-[20px] border border-line bg-white p-3 shadow-[0_6px_24px_rgba(28,25,23,0.07)]">
              {/* The shop's logo picture when it has one (trial shops), else its app icon. */}
              <img
                src={logoUrl ?? `${import.meta.env.BASE_URL}pwa-192.png`}
                alt=""
                className={'size-11 shrink-0 object-cover ' + (logoUrl ? 'rounded-full border border-line bg-white' : 'rounded-xl')}
              />
              <p className="m-0 flex-1 text-[13px] leading-snug">
                {g('התקן', 'התקיני', 'התקינו')} את האפליקציה של {SHOP.brand} למסך הבית לגישה מהירה
              </p>
              <button type="button" onClick={install} className="press h-9 rounded-full bg-brand px-3.5 text-[13px] font-semibold text-brand-accent">
                התקנה
              </button>
              <button type="button" aria-label="סגור" onClick={dismiss} className="press -me-1 flex size-9 items-center justify-center rounded-full text-ink-soft">
                <X size={18} />
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <Sheet
        open={help}
        onClose={() => setHelp(false)}
        label="התקנה למסך הבית"
        footer={
          <Button block onClick={() => setHelp(false)}>
            הבנתי
          </Button>
        }
      >
        <SheetTitle>התקנה למסך הבית</SheetTitle>
        <ol className="m-0 mt-4 flex list-none flex-col gap-3 p-0 text-[15px]">
          {isIOS() ? (
            <>
              <li className="flex items-center gap-3 rounded-2xl bg-surface p-3.5">
                <Share size={22} className="shrink-0" />
                {/crios|fxios|edgios/i.test(navigator.userAgent)
                  ? 'לוחצים על כפתור השיתוף בשורת הכתובת למעלה'
                  : 'לוחצים על כפתור השיתוף (ריבוע עם חץ). אם הוא לא מופיע, הוא בתפריט "..."'}
              </li>
              <li className="flex items-center gap-3 rounded-2xl bg-surface p-3.5">
                <Download size={22} className="shrink-0" /> גוללים ובוחרים "הוספה למסך הבית", ואז "הוסף"
              </li>
            </>
          ) : (
            <>
              <li className="flex items-center gap-3 rounded-2xl bg-surface p-3.5">פותחים את התפריט של הדפדפן (שלוש הנקודות)</li>
              <li className="flex items-center gap-3 rounded-2xl bg-surface p-3.5">
                <Download size={22} /> בוחרים "התקנת אפליקציה" או "הוספה למסך הבית"
              </li>
            </>
          )}
        </ol>
      </Sheet>
    </>
  );
}
