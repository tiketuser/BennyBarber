// Domain model. These shapes map 1:1 to Firestore documents (see src/data/firebase/README.md).

/** Calendar date in local time, 'YYYY-MM-DD'. */
export type DateKey = string;
/** Minutes since midnight, e.g. 17:30 -> 1050. */
export type Minutes = number;
/** 0 = Sunday (א׳) ... 6 = Saturday (ש׳). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Role = 'customer' | 'admin';

export interface Service {
  id: string;
  name: string;
  /** Short label for chips and tight spots, e.g. "חייל". */
  shortName: string;
  price: number;
  durationMin: number;
  /** Customers see "מחיר במספרה" instead of the price. */
  priceHidden: boolean;
  popular?: boolean;
  order: number;
}

export interface DayHours {
  open: boolean;
  from: Minutes;
  to: Minutes;
}

export interface TimeRange {
  from: Minutes;
  to: Minutes;
}

export interface Vacation {
  id: string;
  from: DateKey;
  to: DateKey;
}

export interface Settings {
  hours: Record<Weekday, DayHours>;
  /** Fixed daily break, or null for none. */
  breakTime: TimeRange | null;
  vacations: Vacation[];
  /** The admin's own profile picture (the round logo); unset = the one from the shop config. */
  logoUrl?: string | null;
}

export type AppointmentStatus = 'booked' | 'cancelled';
export type AppointmentSource = 'app' | 'walkin' | 'admin';

export interface Appointment {
  id: string;
  date: DateKey;
  start: Minutes;
  end: Minutes;
  serviceId: string;
  /** Denormalized so history survives service edits/deletes. */
  serviceName: string;
  price: number;
  customerName: string;
  phone: string;
  /** Digits-only phone of the customer account that booked it (for "my appointments"). */
  customerPhone?: string;
  /** Sign-in id of the customer who booked it (customers sign in without an SMS code; this is what makes it theirs). */
  customerUid?: string;
  notes?: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  createdAt: number;
  cancelledAt?: number;
  cancelledBy?: Role;
  /** Admin dismissed the "התפנה תור" alert for this cancellation. */
  openingHandled?: boolean;
  /** Admin removed it because the client didn't come (a cancellation that frees the slot, no waitlist alert). */
  noShow?: boolean;
  /** Minutes the barber pushed it back with "מתעכב" (removing the delay moves it back by this much). */
  delayMin?: number;
}

export interface Block {
  id: string;
  date: DateKey;
  start: Minutes;
  end: Minutes;
  label?: string;
}

export type DayPart = 'morning' | 'noon' | 'evening' | 'any';

export interface WaitlistEntry {
  id: string;
  date: DateKey;
  part: DayPart;
  name: string;
  phone: string;
  customerPhone?: string;
  customerUid?: string;
  createdAt: number;
}

export type GalleryCategory = 'haircut' | 'beard' | 'kids';

export interface GalleryItem {
  id: string;
  /** Image URL; undefined renders a placeholder until real photos are uploaded. */
  src?: string;
  category: GalleryCategory;
  pinned: boolean;
  order: number;
}

export interface Session {
  phone: string;
  name: string | null;
  role: Role;
}

/** The whole shared state the UI renders from. Firestore listeners keep the same shape fresh. */
export interface DbSnapshot {
  services: Service[];
  settings: Settings;
  appointments: Appointment[];
  blocks: Block[];
  waitlist: WaitlistEntry[];
  gallery: GalleryItem[];
  /** The admin's appointments haven't arrived yet (first load): screens show a placeholder, not an empty day. */
  loading?: boolean;
}
