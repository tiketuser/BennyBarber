import { Scissors } from 'lucide-react';
import { SHOP } from '@/config/shop';
import { useLogoUrl } from './useLogoUrl';

const url = `url(${import.meta.env.BASE_URL}logo-mark.svg)`;

/**
 * The round badge's mark: the shop's own logo (shops/<id>/public/logo-mark.svg) when it has one, otherwise scissors.
 * The logo is drawn as a mask, so it takes the text color like the icon does, whatever color the SVG was drawn in.
 * A logo picture (SHOP.logoUrl) is round already and covers the whole badge instead.
 */
export function ShopMark({ size, className }: { size: number; className?: string }) {
  const logoUrl = useLogoUrl();
  if (logoUrl) {
    const side = Math.round(size * 2.2);
    return <img src={logoUrl} alt="" aria-hidden className="block max-h-full max-w-full shrink-0 rounded-full bg-white object-cover" style={{ width: side, height: side }} />;
  }
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
