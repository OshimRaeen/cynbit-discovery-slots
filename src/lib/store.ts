import type { Booking } from './types';

export class DuplicateSlotError extends Error {
  constructor() {
    super('That slot is already booked');
    this.name = 'DuplicateSlotError';
  }
}

// The only things the booking logic needs from a database. Keeping it this small is what
// lets the tests run against memory while production runs against MongoDB.
export interface BookingStore {
  // Must fail with DuplicateSlotError if the slot is taken. That check has to live inside
  // the database (a unique index), not in code that reads first and writes after.
  insert(booking: Booking): Promise<void>;
  takenSlots(fromIso: string, toIso: string): Promise<string[]>;
  findByRef(ref: string): Promise<Booking | null>;
  findUpcomingByEmail(email: string, nowIso: string): Promise<Booking | null>;
}

// In-memory version, for tests and local development.
export function createMemoryStore(options: { jitterMs?: number } = {}): BookingStore {
  const bySlot = new Map<string, Booking>();

  return {
    async insert(booking) {
      // Optional random delay so concurrent callers really do interleave in tests.
      if (options.jitterMs) await new Promise((r) => setTimeout(r, Math.random() * options.jitterMs!));
      // Check and write happen with no await in between, which is what a unique index gives you.
      if (bySlot.has(booking.slotStart)) throw new DuplicateSlotError();
      bySlot.set(booking.slotStart, booking);
    },
    async takenSlots(fromIso, toIso) {
      return [...bySlot.keys()].filter((s) => s >= fromIso && s <= toIso);
    },
    async findByRef(ref) {
      return [...bySlot.values()].find((b) => b.ref === ref) ?? null;
    },
    async findUpcomingByEmail(email, nowIso) {
      return [...bySlot.values()].find((b) => b.email === email && b.slotStart > nowIso) ?? null;
    },
  };
}
