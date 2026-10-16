// Thin platform layer: the only place that knows if we run as a website/PWA or inside Capacitor.
// Swap these bodies for Capacitor plugins (@capacitor/haptics, @capacitor/share, @capacitor/app-launcher)
// when the native shells are added; the rest of the app keeps calling the same functions.
import { Capacitor } from '@capacitor/core';
import type { DateKey, Minutes } from '@/domain/types';
import { fromKey } from './time';

export const isNative = () => Capacitor.isNativePlatform();

export const isStandalone = () =>
  isNative() ||
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function openExternal(url: string) {
  if (url.startsWith('tel:')) {
    window.location.href = url;
    return;
  }
  window.open(url, '_blank', 'noopener');
}

type HapticKind = 'light' | 'success' | 'warning';
export function haptic(kind: HapticKind = 'light') {
  const pattern = kind === 'success' ? [12, 40, 18] : kind === 'warning' ? [20, 60, 20] : 10;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported (iOS Safari) */
  }
}

/** Native share sheet when available (WhatsApp status, etc.), otherwise WhatsApp with the text. */
export async function shareText(text: string): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  openExternal(`https://wa.me/?text=${encodeURIComponent(text)}`);
}

const icsDate = (date: DateKey, m: Minutes) => {
  const d = fromKey(date);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};

/** "הוסף ליומן": an .ics file opens straight into Apple/Google Calendar on phones. */
export function addToCalendar(opts: { title: string; date: DateKey; start: Minutes; end: Minutes; location: string; notes?: string }) {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BennyBarber//HE',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@bennybarber`,
    `DTSTAMP:${icsDate(opts.date, 0)}`,
    `DTSTART:${icsDate(opts.date, opts.start)}`,
    `DTEND:${icsDate(opts.date, opts.end)}`,
    `SUMMARY:${opts.title}`,
    `LOCATION:${opts.location}`,
    opts.notes ? `DESCRIPTION:${opts.notes}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:תזכורת לתור',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'תור-במספרה.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
