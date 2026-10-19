// Thin platform layer: the only place that knows if we run as a website/PWA or inside Capacitor.
// Swap these bodies for Capacitor plugins (@capacitor/haptics, @capacitor/share, @capacitor/app-launcher)
// when the native shells are added; the rest of the app keeps calling the same functions.
import { Capacitor } from '@capacitor/core';
import type { DateKey, Minutes } from '@/domain/types';
import { fromKey } from './time';

const isNative = () => Capacitor.isNativePlatform();

export const isStandalone = () =>
  isNative() || window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

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

const icsStamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
const icsDate = (date: DateKey, m: Minutes) => {
  const d = fromKey(date);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return icsStamp(d);
};
/** RFC 5545 text: commas, semicolons and backslashes must be escaped ("אריה שנקר 65, חולון"). */
const icsText = (s: string) => s.replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');

export interface CalendarEvent {
  title: string;
  date: DateKey;
  start: Minutes;
  end: Minutes;
  location: string;
  notes?: string;
  /** Unique per appointment, so adding it again updates the event instead of duplicating it. */
  uid?: string;
  /** Reminder this many minutes before (default 60). */
  alarmMin?: number;
}

const icsEvent = (e: CalendarEvent, i: number) => [
  'BEGIN:VEVENT',
  `UID:${e.uid ?? `${Date.now()}-${i}`}@barber-booking`,
  `DTSTAMP:${icsStamp(new Date())}`,
  `DTSTART:${icsDate(e.date, e.start)}`,
  `DTEND:${icsDate(e.date, e.end)}`,
  `SUMMARY:${icsText(e.title)}`,
  `LOCATION:${icsText(e.location)}`,
  e.notes ? `DESCRIPTION:${icsText(e.notes)}` : '',
  'BEGIN:VALARM',
  `TRIGGER:-PT${e.alarmMin ?? 60}M`,
  'ACTION:DISPLAY',
  'DESCRIPTION:תזכורת לתור',
  'END:VALARM',
  'END:VEVENT',
];

/** The .ics text for one or more events (Apple Calendar, and any calendar app that opens .ics files). */
export const icsFile = (events: CalendarEvent[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Barbershop booking//HE', ...events.flatMap(icsEvent), 'END:VCALENDAR'].filter(Boolean).join('\r\n');

/** "הוסף ליומן": an .ics file opens straight into Apple/Google Calendar on phones. Several events go in one file. */
export function addToCalendar(event: CalendarEvent | CalendarEvent[]) {
  const ics = icsFile(Array.isArray(event) ? event : [event]);
  // iPhone saves a downloaded .ics to Files instead of opening it. Opening it as a page
  // shows the system "Add to Calendar" sheet instead.
  if (isIOS()) {
    window.location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
    return;
  }
  downloadIcs(ics, Array.isArray(event) && event.length > 1 ? 'תורים.ics' : 'תור.ics');
}

/** Saves an .ics file (on iPhone too), e.g. to import into Google Calendar. */
export function downloadIcs(ics: string, name: string) {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
