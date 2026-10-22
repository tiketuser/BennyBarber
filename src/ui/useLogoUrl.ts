import { SHOP } from '@/config/shop';
import { useDb } from '@/data/store';

/** The round profile picture: the admin's own upload, else the shop config's logo picture. */
export function useLogoUrl(): string | undefined {
  return useDb().settings.logoUrl ?? SHOP.logoUrl;
}
