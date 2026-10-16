import type { Appointment, Service } from '@/domain/types';

export const money = (v: number) => '₪' + v.toLocaleString('en-US');

/** What a customer sees as the price of a service. */
export const customerPrice = (s: Pick<Service, 'price' | 'priceHidden'>) => (s.priceHidden ? 'מחיר במספרה' : money(s.price));

/** Price of a booked appointment as the customer sees it: what they booked at, unless the price is hidden. */
export const appointmentPrice = (a: Appointment, services: Service[]) => (services.find((s) => s.id === a.serviceId)?.priceHidden ? 'מחיר במספרה' : money(a.price));

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
