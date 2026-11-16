import type { Minutes } from '@/domain/types';
import type { WalkInInput } from './backend';

/** The end of an admin-added appointment: the chosen end, or the service's length. */
export function walkInEnd(input: WalkInInput, durationMin: Minutes): Minutes {
  const end = input.end ?? input.start + durationMin;
  if (end <= input.start) throw new Error('שעת הסיום צריכה להיות אחרי שעת ההתחלה');
  return end;
}
