import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Loader2 } from 'lucide-react';
import { useBackend } from '@/data/store';
import { isValidMobile, phoneDigits } from '@/lib/phone';
import { haptic } from '@/lib/platform';
import { ADMIN_PHONES, BACKEND, SHOP, g } from '@/config/shop';
import { Button, PhoneInput, TextInput } from '@/ui/controls';
import { cx } from '@/ui/cx';
import { spring } from '@/ui/motion';
import { firstName } from '../format';
import { ShopMark } from '@/ui/ShopMark';

type Step = 'phone' | 'code' | 'name' | 'done';
const CODE_LENGTH = 6;

/**
 * Customers: phone number and name, no code. Admin numbers: a 6-digit SMS code (Firebase phone auth always sends 6),
 * then the admin view.
 */
export function LoginScreen({ onDone, bare }: { onDone: () => void; /** Without the logo header, inside the desktop card. */ bare?: boolean }) {
  const backend = useBackend();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<'admin' | 'customer'>('customer');
  const codeRef = useRef<HTMLInputElement>(null);
  const adminPhone = ADMIN_PHONES.includes(phoneDigits(phone));

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      haptic('warning');
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      await backend.auth.sendCode(phone);
      setCode('');
      setStep('code');
    });

  const verify = (c: string) =>
    run(async () => {
      const s = await backend.auth.verifyCode(phone, c);
      setRole(s.role);
      if (s.role === 'customer' && !s.name) setStep('name');
      else {
        haptic('success');
        setStep('done');
      }
    });

  const toName = () => {
    setRole('customer');
    setError(null);
    setStep('name');
  };

  const saveName = () =>
    run(async () => {
      // Signed in by SMS already (an older customer account without a name): just the name.
      if (backend.auth.getSession()) await backend.auth.saveName(name);
      else await backend.auth.signInCustomer(phone, name);
      haptic('success');
      setStep('done');
    });

  // Move focus straight from the phone field to the code field while the keyboard is still up: iPhone only shows
  // the "from Messages" code suggestion above an open keyboard, and won't reopen it without a tap.
  useEffect(() => {
    if (step === 'code') codeRef.current?.focus({ preventScroll: true });
  }, [step]);

  const cta =
    step === 'phone'
      ? adminPhone
        ? { label: g('שלח לי קוד', 'שלחי לי קוד', 'שלחו לי קוד'), ok: true, run: sendCode }
        : { label: g('המשך', 'המשיכי', 'המשיכו'), ok: isValidMobile(phone), run: async () => toName() }
      : step === 'code'
        ? { label: 'אישור', ok: code.length === CODE_LENGTH, run: () => verify(code) }
        : step === 'name'
          ? { label: g('שמור והמשך', 'שמרי והמשיכי', 'שמרו והמשיכו'), ok: name.trim().length >= 2, run: saveName }
          : { label: role === 'admin' ? 'לתצוגת אדמין' : 'לקביעת תור', ok: true, run: async () => onDone() };

  return (
    <div className="flex h-full flex-col bg-white pt-safe">
      {!bare && (
        <div className="flex flex-col items-center gap-3 px-6 pt-14 text-center">
          <div className="flex size-[72px] items-center justify-center rounded-full bg-brand text-brand-accent">
            <ShopMark size={32} />
          </div>
          <div className="font-brand text-[30px] leading-none">{SHOP.brand}</div>
          <div className="text-sm text-ink-soft">
            {SHOP.kind} • {SHOP.address}
          </div>
        </div>
      )}

      <form
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        onSubmit={(e) => {
          e.preventDefault();
          if (cta.ok && !busy) cta.run();
        }}
      >
        <div className={cx('relative overflow-hidden px-6', bare ? 'mt-8' : 'mt-10')}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.section
              key={step}
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={spring.ui}
              className="flex flex-col gap-2.5"
            >
              {step === 'phone' && (
                <>
                  <h1 className="m-0 text-2xl font-bold">מה המספר שלך?</h1>
                  <p className="m-0 text-[15px] text-ink-soft">{adminPhone ? 'זה מספר של מנהל, נשלח לך קוד ב-SMS.' : 'כדי שנוכל לשמור לך את התור.'}</p>
                  <label htmlFor="lphone" className="sr-only">
                    מספר נייד
                  </label>
                  <PhoneInput id="lphone" autoFocus value={phone} onChange={setPhone} className="mt-2 h-[60px] rounded-2xl border-2 border-brand text-[22px] font-semibold" />
                </>
              )}

              {step === 'code' && (
                <>
                  <h1 className="m-0 text-2xl font-bold">{g('הזן את הקוד', 'הזיני את הקוד', 'הזינו את הקוד')}</h1>
                  <p className="m-0 text-[15px] text-ink-soft">
                    שלחנו קוד בן 6 ספרות ל-<span dir="ltr">{phone}</span>{' '}
                    <button type="button" className="text-sm font-semibold underline" onClick={() => setStep('phone')}>
                      שינוי
                    </button>
                  </p>
                  <div className="relative mt-2 flex gap-2" dir="ltr">
                    {Array.from({ length: CODE_LENGTH }, (_, i) => (
                      <span
                        key={i}
                        aria-hidden
                        className={cx(
                          'num flex h-14 flex-1 items-center justify-center rounded-xl text-2xl font-bold transition-colors',
                          i === code.length ? 'border-2 border-brand bg-white' : code[i] ? 'border border-line bg-surface' : 'border border-line bg-white',
                        )}
                      >
                        {code[i] ?? ''}
                      </span>
                    ))}
                    <label htmlFor="lcode" className="sr-only">
                      קוד אימות
                    </label>
                    <input
                      ref={codeRef}
                      id="lcode"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      maxLength={CODE_LENGTH}
                      value={code}
                      onChange={(e) => {
                        const c = phoneDigits(e.target.value).slice(0, CODE_LENGTH);
                        setCode(c);
                        if (c.length === CODE_LENGTH && !busy) verify(c);
                      }}
                      // Invisible text, not opacity-0: iPhone skips code autofill for fully transparent fields. 16px avoids zoom.
                      className="absolute inset-0 bg-transparent text-[16px] text-transparent caret-transparent outline-none selection:bg-transparent"
                    />
                  </div>
                  <button type="button" disabled={busy} onClick={sendCode} className="h-11 self-start text-sm font-medium text-ink-soft">
                    לא הגיע? {g('שלח שוב', 'שלחי שוב', 'שלחו שוב')}
                  </button>
                </>
              )}

              {step === 'name' && (
                <>
                  <h1 className="m-0 text-2xl font-bold">נעים להכיר! איך קוראים לך?</h1>
                  <p className="m-0 text-[15px] text-ink-soft">
                    נשמור את זה, ולא {g('תצטרך', 'תצטרכי', 'תצטרכו')} למלא שוב בכל תור.{' '}
                    {!backend.auth.getSession() && (
                      <button type="button" className="text-sm font-semibold underline" onClick={() => setStep('phone')}>
                        שינוי מספר
                      </button>
                    )}
                  </p>
                  <label htmlFor="lname" className="sr-only">
                    שם מלא
                  </label>
                  <TextInput
                    id="lname"
                    autoFocus
                    autoComplete="name"
                    placeholder="שם מלא"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-2 h-[60px] rounded-2xl border-2 border-brand text-xl font-medium"
                  />
                </>
              )}

              {step === 'done' && (
                <div className="flex flex-col items-center gap-2.5 text-center">
                  <motion.span
                    initial={{ scale: 0.6 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.4, duration: 0.5 }}
                    className="flex size-[60px] items-center justify-center rounded-full bg-open text-white"
                  >
                    <Check size={30} strokeWidth={2.5} />
                  </motion.span>
                  <h1 className="m-0 mt-1.5 text-2xl font-bold">{role === 'admin' ? 'שלום, מנהל' : `היי ${firstName(name || backend.auth.getSession()?.name || '')}, הכל מוכן`}</h1>
                  <p className="m-0 text-[15px] leading-normal text-ink-soft">
                    {role === 'admin' ? `זיהינו את המספר שלך כמנהל ${SHOP.place}. מעבירים אותך ליומן.` : 'שמרנו את השם והמספר שלך. בפעם הבאה קביעת תור לוקחת שתי לחיצות.'}
                  </p>
                </div>
              )}
            </motion.section>
          </AnimatePresence>
          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-danger">
              {error}
            </p>
          )}
        </div>

        {/* Right under the field, so the phone keyboard never hides it. */}
        <div className="px-6 pb-bar-lg pt-5">
          <Button
            type="submit"
            block
            // Keep the field focused (and the keyboard open) when tapping send/confirm.
            onPointerDown={(e) => step !== 'done' && e.preventDefault()}
            onMouseDown={(e) => step !== 'done' && e.preventDefault()}
            disabled={!cta.ok || busy}
            icon={busy ? <Loader2 size={20} className="animate-spin" /> : undefined}
          >
            {cta.label}
          </Button>
          {step === 'phone' && adminPhone && BACKEND === 'firebase' && (
            // Google's required notice, in place of the floating reCAPTCHA badge that covered the button.
            <p className="m-0 mt-3 text-center text-[11px] leading-snug text-ink-mute">
              האתר מוגן על ידי reCAPTCHA ו
              <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="underline">
                מדיניות הפרטיות
              </a>{' '}
              ו
              <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="underline">
                תנאי השימוש
              </a>{' '}
              של Google חלים.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
