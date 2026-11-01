import { generateSlots } from '@/lib/slots';
import { getStore } from '@/lib/getStore';
import BookingFlow, { type DayView } from '@/components/BookingFlow';

// Availability changes every time someone books, so this page is never cached.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const days = generateSlots(new Date());
  const first = days[0]?.slots[0]?.start;
  const last = days.at(-1)?.slots.at(-1)?.start;

  let taken = new Set<string>();
  let storeDown = false;
  try {
    if (first && last) taken = new Set(await getStore().takenSlots(first, last));
  } catch {
    // If we can't read bookings we can't show honest availability, so don't pretend.
    storeDown = true;
  }

  const view: DayView[] = days.map((d) => ({
    date: d.date,
    slots: d.slots.map((s) => ({ start: s.start, taken: taken.has(s.start) })),
  }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand">Cynbit services</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Book a discovery call</h1>
      <p className="mt-3 max-w-xl text-muted">
        Pick a service and a time that suits you. A service lead joins the call, so there is no waiting for an email
        reply to find a slot.
      </p>

      <div className="mt-8">
        {storeDown ? (
          <div role="alert" className="rounded-2xl border border-line bg-white p-6">
            <h2 className="font-semibold">Booking is temporarily unavailable</h2>
            <p className="mt-1 text-sm text-muted">
              We couldn&apos;t load the calendar. Please refresh in a minute, or email opportunities@cynbit.in.
            </p>
          </div>
        ) : (
          <BookingFlow days={view} />
        )}
      </div>
    </main>
  );
}
