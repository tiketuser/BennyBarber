import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { useBackend, useDb } from '@/data/store';
import { haptic } from '@/lib/platform';
import { cx } from '@/ui/cx';
import { ShopMark } from '@/ui/ShopMark';
import { useToast } from '@/ui/useToast';

/** Square-crops and shrinks a photo for the round profile picture. */
async function squareLogo(file: Blob, side = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('לא הצלחנו לקרוא את התמונה');
  });
  const s = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(side, s);
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - s) / 2, (bitmap.height - s) / 2, s, s, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('לא הצלחנו לעבד את התמונה'))), 'image/jpeg', 0.88));
}

/** "תמונת פרופיל": the admin picks the round picture customers see on sign-in and in the header. */
export function LogoCard({ className }: { className?: string }) {
  const backend = useBackend();
  const db = useDb();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const own = !!db.settings.logoUrl;

  const set = async (file: Blob | null) => {
    setBusy(true);
    try {
      await backend.settings.setLogo(file && (await squareLogo(file)));
      haptic('success');
      toast({ text: file ? 'תמונת הפרופיל הוחלפה' : 'חזרנו ללוגו המקורי' });
    } catch (e) {
      toast({ text: (e as Error).message, tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cx('flex items-center gap-3 rounded-[20px] border border-line p-3.5', className)}>
      <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-brand-accent">
        <ShopMark size={24} />
      </span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-bold">תמונת פרופיל</span>
        <span className="text-[13px] text-ink-soft">מופיעה ללקוחות בכניסה ובראש האפליקציה</span>
        {own && (
          <button type="button" disabled={busy} onClick={() => set(null)} className="self-start text-[13px] font-semibold text-ink-soft underline">
            חזרה ללוגו המקורי
          </button>
        )}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="press flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3 text-[13px] font-semibold text-brand-accent disabled:opacity-60"
      >
        <Camera size={16} />
        {busy ? 'מעלה...' : 'החלף תמונה'}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        aria-label="בחר תמונת פרופיל"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void set(f);
        }}
      />
    </div>
  );
}
