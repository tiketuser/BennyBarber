import { Scissors } from 'lucide-react';
import { SHOP } from '@/config/shop';

const url = `url(${import.meta.env.BASE_URL}logo-mark.svg)`;

/**
 * The round badge's mark: the shop's own logo (shops/<id>/public/logo-mark.svg) when it has one, otherwise scissors.
 * The logo is drawn as a mask, so it takes the text color like the icon does, whatever color the SVG was drawn in.
 */
export function ShopMark({ size, className }: { size: number; className?: string }) {
  if (!SHOP.logoMark) return <Scissors size={size} className={className} />;
  const side = Math.round(size * 1.3);
  return (
    <span
      aria-hidden
      className={'block shrink-0 bg-current ' + (className ?? '')}
      style={{ width: side, height: side, mask: `${url} center / contain no-repeat`, WebkitMask: `${url} center / contain no-repeat` }}
    />
  );
}
