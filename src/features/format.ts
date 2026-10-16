import type { Service } from '@/domain/types';

export const money = (v: number) => '₪' + v.toLocaleString('en-US');

/** What a customer sees as the price of a service. */
export const customerPrice = (s: Pick<Service, 'price' | 'priceHidden'>) => (s.priceHidden ? 'מחיר במספרה' : money(s.price));

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
