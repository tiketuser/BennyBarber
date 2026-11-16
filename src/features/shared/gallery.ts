import type { GalleryCategory } from '@/domain/types';

export const GALLERY_CATEGORIES: { id: GalleryCategory; label: string }[] = [
  { id: 'haircut', label: 'תספורות' },
  { id: 'beard', label: 'זקן' },
  { id: 'kids', label: 'ילדים' },
];

/** Customer gallery filter chips. */
export const GALLERY_FILTERS: { id: GalleryCategory | 'all'; label: string }[] = [{ id: 'all', label: 'הכל' }, ...GALLERY_CATEGORIES];
