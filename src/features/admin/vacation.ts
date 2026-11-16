import type { Appointment } from '@/domain/types';
import { fmtDayMonth, fmtTime } from '@/lib/time';
import { firstName } from '../format';
import { SHOP } from '@/config/shop';

/** WhatsApp text to a customer whose appointment falls on a vacation day. */
export const vacationMessage = (a: Appointment) =>
  `היי ${firstName(a.customerName)}, ${SHOP.closed} ב${fmtDayMonth(a.date)} ולכן התור שלך ב-${fmtTime(a.start)} בוטל. אפשר לקבוע מועד חדש באפליקציה. סליחה ותודה!`;
