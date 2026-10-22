// The one contract between the UI and any backend.
// Today: MockBackend (in-memory + localStorage). Next: FirebaseBackend (Firestore + Firebase phone auth)
// implementing exactly this interface, so no screen has to change.
import type {
  Appointment,
  Block,
  DateKey,
  DayHours,
  DayPart,
  DbSnapshot,
  GalleryCategory,
  GalleryItem,
  Minutes,
  Service,
  Session,
  TimeRange,
  Vacation,
  Weekday,
} from '@/domain/types';

export interface BookingInput {
  serviceId: string;
  date: DateKey;
  start: Minutes;
  customerName: string;
  phone: string;
  notes?: string;
  /** When rescheduling, the appointment this one replaces. */
  replacesId?: string;
}

export interface WalkInInput {
  serviceId: string;
  date: DateKey;
  start: Minutes;
  /** Admin-chosen end (half an hour, an hour, or a custom range). Defaults to the service's length. */
  end?: Minutes;
  /** Admin squeezes the client in although the time overlaps other appointments. */
  squeeze?: boolean;
  customerName?: string;
  phone?: string;
  notes?: string;
}

export interface Backend {
  // Live data. getSnapshot must return the same object until something changes (useSyncExternalStore).
  subscribe(listener: () => void): () => void;
  getSnapshot(): DbSnapshot;

  auth: {
    getSession(): Session | null;
    subscribe(listener: () => void): () => void;
    /**
     * Customers: phone and name, no SMS code (Firebase: an anonymous sign-in that owns its bookings). Admin numbers
     * are refused here and go through the SMS code instead.
     */
    signInCustomer(phone: string, name: string): Promise<Session>;
    /** Sends the SMS code (admin numbers). Firebase: signInWithPhoneNumber + reCAPTCHA (web) / native plugin (Capacitor). */
    sendCode(phone: string): Promise<void>;
    /** Verifies the code; role comes from the backend (admin phone list), never from the client. */
    verifyCode(phone: string, code: string): Promise<Session>;
    saveName(name: string): Promise<void>;
    signOut(): Promise<void>;
  };

  appointments: {
    book(input: BookingInput): Promise<Appointment>;
    addWalkIn(input: WalkInInput): Promise<Appointment>;
    /** Customers can cancel their own appointments, the admin any. Frees the slot for the waitlist alert. */
    cancel(id: string): Promise<void>;
    /** Admin: the client didn't come. Takes the appointment off the day; false puts it back (undo). */
    setNoShow(id: string, noShow: boolean): Promise<void>;
    /** Admin: push these appointments of one day later by `minutes` (negative moves them back), adding up in delayMin. */
    delay(date: DateKey, ids: string[], minutes: number): Promise<void>;
    markOpeningHandled(id: string): Promise<void>;
    /** Admin: new times for some appointments of one day (a longer or shorter appointment, and the ones after it). */
    retime(date: DateKey, times: { id: string; start: Minutes; end: Minutes }[]): Promise<void>;
  };

  blocks: {
    add(date: DateKey, start: Minutes, end: Minutes, label?: string): Promise<Block>;
    update(id: string, range: TimeRange): Promise<void>;
    remove(id: string): Promise<void>;
  };

  waitlist: {
    join(date: DateKey, part: DayPart, name: string, phone: string): Promise<void>;
    leave(id: string): Promise<void>;
  };

  services: {
    add(input: Omit<Service, 'id' | 'order'>): Promise<Service>;
    update(id: string, patch: Partial<Omit<Service, 'id'>>): Promise<void>;
    remove(id: string): Promise<void>;
    restore(service: Service): Promise<void>;
  };

  settings: {
    setHours(days: Weekday[], hours: DayHours): Promise<void>;
    setBreak(range: TimeRange | null): Promise<void>;
    addVacation(from: DateKey, to: DateKey): Promise<Vacation>;
    removeVacation(id: string): Promise<void>;
    /** A new profile picture (already shrunk), or null to go back to the shop's own logo. */
    setLogo(photo: Blob | null): Promise<void>;
  };

  gallery: {
    /** Adds a photo (already shrunk, see lib/image.ts) at the start of the gallery. */
    upload(photo: Blob, category: GalleryCategory): Promise<GalleryItem>;
    togglePin(id: string): Promise<void>;
    remove(id: string): Promise<void>;
    /** Undo for remove. */
    restore(item: GalleryItem): Promise<void>;
  };
}
