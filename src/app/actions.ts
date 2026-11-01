'use server';

import { headers } from 'next/headers';
import { handleBooking, type BookingResult } from '@/lib/booking';
import { FixedWindowLimiter } from '@/lib/rateLimit';
import { getStore } from '@/lib/getStore';

// 8 attempts per 10 minutes per address. In memory, so each serverless instance counts on its
// own; a real deployment would keep this in Redis (see README).
const limiter = new FixedWindowLimiter({ limit: 8, windowMs: 10 * 60_000 });

export async function bookSlot(formData: FormData): Promise<BookingResult> {
  const h = await headers();
  // On Vercel this header is set by the platform, so the first entry can be trusted.
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown';

  try {
    return await handleBooking(formData, { ip, limiter, store: getStore() });
  } catch {
    // Misconfiguration (for example a missing database URL) still reaches the visitor as a message.
    return { success: false, code: 'FAILED', message: 'Booking is unavailable right now. Please try again later.' };
  }
}
