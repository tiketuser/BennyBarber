import { useEffect } from 'react';
import { useDb } from '@/data/store';

const setLink = (rel: string, href: string) => {
  const el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`) ?? document.head.appendChild(Object.assign(document.createElement('link'), { rel }));
  el.href = href;
};

/**
 * The admin's own profile picture also becomes the tab icon, the iPhone home-screen icon and the install icon,
 * for the next time someone adds the app (an icon already on a home screen stays until it's added again).
 */
export function useLogoIcons() {
  const logoUrl = useDb().settings.logoUrl;
  useEffect(() => {
    if (!logoUrl) return;
    setLink('icon', logoUrl);
    setLink('apple-touch-icon', logoUrl);
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifest) return;
    let cancelled = false;
    fetch(manifest.href)
      .then((r) => r.json())
      .then((m: { start_url?: string; scope?: string; id?: string; icons?: unknown[] }) => {
        if (cancelled) return;
        // A manifest from a blob: address resolves its own addresses against nothing, so keep them absolute.
        const abs = (u?: string) => (u ? new URL(u, manifest.href.startsWith('blob:') ? location.href : manifest.href).href : u);
        const icons = [
          { src: logoUrl, sizes: '192x192', type: 'image/jpeg' },
          { src: logoUrl, sizes: '512x512', type: 'image/jpeg' },
        ];
        const next = { ...m, start_url: abs(m.start_url), scope: abs(m.scope), id: m.id ? abs(m.id) : undefined, icons };
        manifest.href = URL.createObjectURL(new Blob([JSON.stringify(next)], { type: 'application/manifest+json' }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);
}
