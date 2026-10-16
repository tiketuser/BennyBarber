import type { Appointment } from '@/domain/types';
import { fmtDayMonth, fmtTime } from '@/lib/time';
import { firstName } from '../format';

/** WhatsApp text to a customer whose appointment falls on a vacation day. */
export const vacationMessage = (a: Appointment) =>
  `היי ${firstName(a.customerName)}, המספרה סגורה ב${fmtDayMonth(a.date)} ולכן התור שלך ב-${fmtTime(a.start)} בוטל. אפשר לקבוע מועד חדש באפליקציה. סליחה ותודה!`;
