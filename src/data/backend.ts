// The one contract between the UI and any backend.
// Today: MockBackend (in-memory + localStorage). Next: FirebaseBackend (Firestore + Firebase phone auth)
// implementing exactly this interface, so no screen has to change.
import type { Appointment, Block, DateKey, DayHours, DayPart, DbSnapshot, Minutes, Service, Session, TimeRange, Vacation, Weekday } from '@/domain/types';

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
    /** Sends the SMS code. Firebase: signInWithPhoneNumber + reCAPTCHA (web) / native plugin (Capacitor). */
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
    markOpeningHandled(id: string): Promise<void>;
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
  };

  gallery: {
    togglePin(id: string): Promise<void>;
  };
}
