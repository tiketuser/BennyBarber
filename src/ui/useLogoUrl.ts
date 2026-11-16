import { useEffect } from 'react';
import { FIREBASE, SHOP } from '@/config/shop';
import { useDb } from '@/data/store';

// The admin's own picture, remembered on this device: the next visit shows it before the shop's settings arrive.
const KEY = `logoUrl:${FIREBASE.shopId}`;
const remembered = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

/**
 * The round profile picture: the admin's own upload, else the shop config's logo picture.
 * `pending`: settings are still loading and this device has nothing remembered, so the picture isn't known yet.
 */
export function useLogo(): { url: string | undefined; pending: boolean } {
  const { settings, settingsLoading } = useDb();
  const own = settings.logoUrl ?? null;
  useEffect(() => {
    if (settingsLoading) return;
    try {
      if (own) localStorage.setItem(KEY, own);
      else localStorage.removeItem(KEY);
    } catch {
      /* private mode */
    }
  }, [own, settingsLoading]);
  if (settingsLoading) {
    const cached = remembered();
    return cached ? { url: cached, pending: false } : { url: undefined, pending: true };
  }
  return { url: own ?? SHOP.logoUrl, pending: false };
}

export function useLogoUrl(): string | undefined {
  return useLogo().url;
}
