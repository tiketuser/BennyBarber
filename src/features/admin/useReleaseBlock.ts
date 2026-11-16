import type { Block } from '@/domain/types';
import { useBackend } from '@/data/store';
import { haptic } from '@/lib/platform';
import { useToast } from '@/ui/useToast';

/** Frees a blocked slot, with undo. */
export function useReleaseBlock() {
  const backend = useBackend();
  const toast = useToast();
  return async (b: Block) => {
    await backend.blocks.remove(b.id);
    haptic();
    toast({ text: 'החסימה שוחררה', action: { label: 'ביטול', run: () => backend.blocks.add(b.date, b.start, b.end, b.label) } });
  };
}
