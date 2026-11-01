import { bookingSchema } from './validation';
import { findOfferedSlot } from './slots';
import { newRef } from './ref';
import { DuplicateSlotError, type BookingStore } from './store';
import type { FixedWindowLimiter } from './rateLimit';
import type { Booking } from './types';

export type BookingResult =
  | { success: true; ref: string }
  | { success: false; code: 'VALIDATION'; message: string; fieldErrors: Record<string, string[]> }
  | { success: false; code: 'RATE_LIMITED'; message: string; retryAfterSec: number }
  | { success: false; code: 'SLOT_UNAVAILABLE' | 'SLOT_TAKEN' | 'ALREADY_BOOKED' | 'FAILED'; message: string };

type Deps = {
  ip: string;
  limiter: FixedWindowLimiter;
  store: BookingStore;
  now?: Date;
};

// Hidden field that real visitors never see. Bots tend to fill in everything.
export const HONEYPOT_FIELD = 'website';

export async function handleBooking(formData: FormData, { ip, limiter, store, now = new Date() }: Deps): Promise<BookingResult> {
  // 1. Too many attempts from one address.
  const limit = limiter.check(ip);
  if (!limit.allowed) {
    return {
      success: false,
      code: 'RATE_LIMITED',
      message: 'Too many attempts. Please wait a little and try again.',
      retryAfterSec: limit.retryAfterSec,
    };
  }

  // 2. Honeypot: pretend it worked, store nothing.
  const trap = formData.get(HONEYPOT_FIELD);
  if (typeof trap === 'string' && trap.length > 0) return { success: true, ref: newRef() };

  // 3. Validate every field on the server. Anything extra in the form is dropped.
  const parsed = bookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      success: false,
      code: 'VALIDATION',
      message: 'Please check the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const input = parsed.data;

  // 4. Only slots we would actually offer right now are bookable.
  const slot = findOfferedSlot(input.slot, now);
  if (!slot) {
    return {
      success: false,
      code: 'SLOT_UNAVAILABLE',
      message: 'That time is no longer available. Please pick another slot.',
    };
  }

  try {
    // 5. One upcoming call per email address.
    const existing = await store.findUpcomingByEmail(input.email, now.toISOString());
    if (existing) {
      return {
        success: false,
        code: 'ALREADY_BOOKED',
        message: 'This email already has an upcoming discovery call. Use a different email to book another.',
      };
    }

    // 6. Write it. If someone else got there first, the database refuses and we say so.
    const booking: Booking = {
      ref: newRef(),
      fullName: input.fullName,
      email: input.email,
      service: input.service,
      slotStart: slot.start,
      slotEnd: slot.end,
      note: input.note,
      createdAt: now.toISOString(),
    };
    await store.insert(booking);
    return { success: true, ref: booking.ref };
  } catch (err) {
    if (err instanceof DuplicateSlotError) {
      return { success: false, code: 'SLOT_TAKEN', message: 'Someone just booked that slot. Please pick another one.' };
    }
    // A database problem comes back as a result, so the form can show a message instead of freezing.
    return { success: false, code: 'FAILED', message: 'We could not save your booking just now. Please try again in a moment.' };
  }
}
