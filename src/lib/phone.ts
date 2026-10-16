/** Keep digits only, max 10 (Israeli mobile). */
export function phoneDigits(v: string): string {
  return v.replace(/\D/g, '').slice(0, 10);
}

/** Formats while typing: "0501234567" -> "050-1234567". */
export function formatPhone(v: string): string {
  const d = phoneDigits(v);
  return d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
}

export function isValidMobile(v: string): boolean {
  return /^05\d{8}$/.test(phoneDigits(v));
}

/** "0501234567" -> "972501234567" for wa.me / tel links. */
export function toIntl(v: string): string {
  const d = phoneDigits(v);
  return d.startsWith('0') ? '972' + d.slice(1) : d;
}
