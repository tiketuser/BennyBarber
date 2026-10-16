import type { ReactNode } from 'react';
import { Button } from './controls';
import { Sheet, SheetTitle } from './Sheet';

/** Confirmation only for genuinely destructive steps (cancelling an appointment). */
export function ConfirmSheet({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  cancelLabel = 'לא, השאר',
  onConfirm,
  tone = 'danger',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  tone?: 'danger' | 'primary';
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={title}
      footer={
        <div className="flex flex-col gap-2">
          <Button block variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button block variant="ghost" size="md" onClick={onClose}>
            {cancelLabel}
          </Button>
        </div>
      }
    >
      <SheetTitle>{title}</SheetTitle>
      {children && <div className="mt-3 text-[15px] leading-relaxed text-ink-soft">{children}</div>}
    </Sheet>
  );
}
