import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { ChevronRight, Minus, Plus } from 'lucide-react';
import { formatPhone } from '@/lib/phone';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'whatsapp' | 'danger' | 'ghost' | 'open';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-brand-accent disabled:bg-surface-sunk disabled:text-ink-mute disabled:opacity-100',
  secondary: 'bg-white border border-line text-ink',
  whatsapp: 'bg-open text-white',
  open: 'bg-open-soft border border-open-line text-open-text',
  danger: 'bg-danger-soft text-danger',
  ghost: 'text-ink-soft',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'lg' | 'md' | 'sm';
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', size = 'lg', icon, block, className, children, ...rest }, ref) {
  const sizes = { lg: 'h-14 rounded-2xl text-[17px] px-5', md: 'h-12 rounded-[14px] text-[15px] px-4', sm: 'h-11 rounded-xl text-sm px-3.5' };
  return (
    <button
      ref={ref}
      type="button"
      className={cx(
        'press inline-flex items-center justify-center gap-2 font-semibold disabled:cursor-default disabled:opacity-40',
        VARIANTS[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

/** Round "−  value  +" control. */
export function Stepper({
  value,
  onDec,
  onInc,
  decLabel,
  incLabel,
  canDec = true,
  canInc = true,
  label,
  big,
}: {
  value: ReactNode;
  onDec: () => void;
  onInc: () => void;
  decLabel: string;
  incLabel: string;
  canDec?: boolean;
  canInc?: boolean;
  label?: string;
  big?: boolean;
}) {
  return (
    <div className={cx('flex items-center gap-2 rounded-[18px]', big ? 'h-16 bg-surface px-2' : 'h-16 border border-line pe-2 ps-3.5')}>
      {label && <span className="w-16 text-[15px] font-medium text-ink-soft">{label}</span>}
      <button
        type="button"
        aria-label={decLabel}
        disabled={!canDec}
        onClick={onDec}
        className={cx('press flex size-12 items-center justify-center rounded-full disabled:opacity-35', big ? 'bg-white' : 'bg-surface')}
      >
        <Minus size={20} />
      </button>
      <div aria-live="polite" className="num flex-1 text-center text-[28px] font-bold">
        {value}
      </div>
      <button
        type="button"
        aria-label={incLabel}
        disabled={!canInc}
        onClick={onInc}
        className="press flex size-12 items-center justify-center rounded-full bg-brand text-brand-accent disabled:opacity-35"
      >
        <Plus size={20} />
      </button>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-200', checked ? 'bg-open' : 'bg-line-strong')}
    >
      <span
        className="absolute top-[3px] size-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-[inset] duration-200"
        style={checked ? { left: 3 } : { left: 23 }}
      />
    </button>
  );
}

/** Pill chip used for single/multi choice. */
export function Chip({ on, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cx(
        'press h-11 rounded-full px-4 text-sm font-semibold transition-colors duration-150',
        on ? 'bg-brand text-brand-accent' : 'border border-line bg-white font-medium text-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export const Field = ({ id, label, hint, children }: { id: string; label: ReactNode; hint?: ReactNode; children: ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-sm font-medium">
      {label}
    </label>
    {children}
    {hint}
  </div>
);

const inputBase = 'h-[52px] w-full rounded-[14px] border bg-white px-4 text-base outline-none transition-colors focus:border-2 focus:border-brand';

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputBase, 'border-line', className)} {...rest} />;
});

/** Israeli mobile input: numeric keypad, dash inserted while typing (05X-XXXXXXX), max 10 digits. */
export const PhoneInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { value: string; onChange: (v: string) => void }>(
  function PhoneInput({ value, onChange, className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="05X-XXXXXXX"
        dir="ltr"
        value={value}
        onChange={(e) => onChange(formatPhone(e.target.value))}
        className={cx(inputBase, 'border-line text-right tracking-wide', className)}
        {...rest}
      />
    );
  },
);

/** Top bar for pushed screens: back button + title + optional trailing content. */
export function ScreenHeader({ title, onBack, aside }: { title?: ReactNode; onBack: () => void; aside?: ReactNode }) {
  return (
    <header className="flex h-[60px] shrink-0 items-center gap-1 px-2 pt-2">
      <button type="button" aria-label="חזרה" onClick={onBack} className="press flex size-11 items-center justify-center rounded-full">
        <ChevronRight size={24} />
      </button>
      {title && <h1 className="m-0 flex-1 text-lg font-semibold">{title}</h1>}
      {!title && <span className="flex-1" />}
      {aside}
    </header>
  );
}

/** WhatsApp chat bubble preview of a message that will be sent. */
export function Bubble({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('self-start rounded-[16px_16px_16px_4px] bg-bubble px-3.5 py-2.5 text-sm leading-relaxed text-ink', className)}>{children}</div>;
}
