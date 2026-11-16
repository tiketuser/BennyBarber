import { Pin, Scissors } from 'lucide-react';
import type { GalleryItem } from '@/domain/types';
import { cx } from '@/ui/cx';

/** One gallery photo (or a placeholder until real photos are uploaded), with a thin pin on picked ones. */
export function GalleryTile({ item, className }: { item: GalleryItem; className?: string }) {
  return (
    <div className={cx('relative overflow-hidden bg-placeholder', className)}>
      {item.src ? (
        <img src={item.src} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-placeholder-ink">
          <Scissors size={22} aria-hidden />
        </div>
      )}
      {item.pinned && (
        <span role="img" aria-label="נעוץ" className="absolute right-[7px] top-[7px] flex text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
          <Pin size={14} strokeWidth={1.75} />
        </span>
      )}
    </div>
  );
}
