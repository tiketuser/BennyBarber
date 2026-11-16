import { toIntl } from './phone';

export const whatsappUrl = (phone: string, text: string) => `https://wa.me/${toIntl(phone)}?text=${encodeURIComponent(text)}`;
export const telUrl = (phone: string) => `tel:+${toIntl(phone)}`;
