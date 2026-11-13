import { LogIn, LogOut, MessageCircle, Phone } from 'lucide-react';
import { SHOP, TRIAL } from '@/config/shop';
import { useBackend } from '@/data/store';
import { whatsappUrl, telUrl } from '@/lib/links';
import { formatPhone } from '@/lib/phone';
import { openExternal } from '@/lib/platform';
import { Button } from '@/ui/controls';
import { ShopMark } from '@/ui/ShopMark';

/**
 * After a trial shop's free week (TRIAL.endsAt). Customers can't book online and get the shop's phone instead;
 * the owner is asked to talk to us about keeping the app. Nothing is deleted, and the security rules stop new
 * customer bookings too (scripts/firebase-rules.mjs).
 */
export function TrialEnded({ admin, onOwnerLogin }: { admin: boolean; onOwnerLogin: () => void }) {
  const backend = useBackend();
  const contact = TRIAL!;
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-brand-accent">
        <ShopMark size={28} />
      </span>
      <div className="flex max-w-sm flex-col gap-2">
        <p className="font-brand text-[15px] text-ink-mute">{SHOP.brand}</p>
        {admin ? (
          <>
            <h1 className="text-[24px] font-bold text-balance">תקופת הניסיון הסתיימה</h1>
            <p className="text-[15px] leading-relaxed text-ink-soft">כל התורים, הלקוחות וההגדרות נשמרו. כדי להמשיך להשתמש באפליקציה, דבר עם {contact.contactName}.</p>
          </>
        ) : (
          <>
            <h1 className="text-[24px] font-bold text-balance">ההזמנה אונליין לא זמינה כרגע</h1>
            <p className="text-[15px] leading-relaxed text-ink-soft">אפשר לקבוע תור בטלפון או בוואטסאפ.</p>
          </>
        )}
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3">
        {admin ? (
          <>
            <Button
              variant="whatsapp"
              block
              icon={<MessageCircle size={20} />}
              onClick={() => openExternal(whatsappUrl(contact.contactPhone, `היי ${contact.contactName}, תקופת הניסיון של האפליקציה של ${SHOP.brand} הסתיימה ואני רוצה להמשיך`))}
            >
              וואטסאפ ל{contact.contactName}
            </Button>
            <Button variant="ghost" block icon={<LogOut size={18} />} onClick={() => backend.auth.signOut()}>
              יציאה
            </Button>
          </>
        ) : (
          <>
            <Button block icon={<Phone size={20} />} onClick={() => openExternal(telUrl(SHOP.phone))}>
              <bdi dir="ltr">{formatPhone(SHOP.phone)}</bdi>
            </Button>
            <Button variant="whatsapp" block icon={<MessageCircle size={20} />} onClick={() => openExternal(whatsappUrl(SHOP.phone, 'היי, אפשר לקבוע תור?'))}>
              וואטסאפ
            </Button>
            <Button variant="ghost" size="sm" className="self-center" icon={<LogIn size={16} />} onClick={onOwnerLogin}>
              כניסה לבעל העסק
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
