import { CalendarDays, MapPin, MessageCircle, RotateCcw, Scissors } from 'lucide-react';
import { useDb } from '@/data/store';
import { SHOP } from '@/config/shop';
import { groupHours } from '../shared/hours';
import { LoginScreen } from './LoginScreen';

const PERKS = [
  { icon: <CalendarDays size={20} />, text: 'קביעת תור אונליין, בלי לחכות על הקו' },
  { icon: <MessageCircle size={20} />, text: 'תזכורת בוואטסאפ לפני התור' },
  { icon: <RotateCcw size={20} />, text: 'מזיזים או מבטלים לבד, מ"התורים שלי"' },
];

/** Desktop sign-in: the shop on a dark panel, the same phone + code steps in a card beside it. */
export function DeskLogin({ onDone }: { onDone: () => void }) {
  const db = useDb();
  const hours = groupHours(db.settings)
    .filter((r) => r.open)
    .map((r) => `${r.label} ${r.value}`)
    .join(', ');

  return (
    <div className="flex h-full">
      <aside aria-label="על המספרה" className="flex flex-[1_1_520px] flex-col gap-10 overflow-y-auto bg-brand px-16 py-12 text-white">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-accent text-brand">
            <Scissors size={22} />
          </span>
          <span className="font-brand text-[26px] leading-none">{SHOP.brand}</span>
        </div>
        <div className="my-auto flex max-w-[480px] flex-col gap-[22px]">
          <span className="flex h-[30px] items-center self-start rounded-full bg-brand-accent/15 px-3 text-[13px] font-semibold text-brand-accent">
            {SHOP.kind} • {SHOP.city}
          </span>
          <h2 className="m-0 font-brand text-[64px] font-normal leading-[1.02]">{SHOP.brand}</h2>
          <p className="m-0 text-[19px] leading-relaxed text-line-strong">נכנסים פעם אחת עם הנייד, ומאז כל תור נקבע בשתי לחיצות.</p>
          <ul className="m-0 mt-2 flex list-none flex-col gap-4 p-0">
            {PERKS.map((p) => (
              <li key={p.text} className="flex items-center gap-3.5 text-base">
                <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-brand-accent">{p.icon}</span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-ink-faint">
          <MapPin size={18} />
          <span>
            {SHOP.address} • <bdi>{hours}</bdi>
          </span>
        </div>
      </aside>

      <main className="flex flex-[1_1_560px] flex-col items-center justify-center gap-6 overflow-y-auto px-8 py-12">
        <div className="relative h-[540px] w-full max-w-[440px] overflow-hidden rounded-[28px] border border-line shadow-[0_20px_48px_rgba(28,25,23,0.08)]">
          <LoginScreen bare onDone={onDone} />
        </div>
        <p className="m-0 text-center text-[13px] text-ink-faint">המספר משמש רק לאישורים ותזכורות לתורים.</p>
      </main>
    </div>
  );
}
