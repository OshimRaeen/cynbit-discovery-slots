import Link from 'next/link';
import { notFound } from 'next/navigation';
import { REF_PATTERN } from '@/lib/ref';
import { getStore } from '@/lib/getStore';
import { SERVICES } from '@/lib/types';
import { istFull } from '@/lib/format';
import LocalTime from '@/components/LocalTime';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your discovery call | Cynbit (prototype)' };

export default async function BookingPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  if (!REF_PATTERN.test(ref)) notFound();

  let booking;
  try {
    booking = await getStore().findByRef(ref);
  } catch {
    return (
      <main className="mx-auto max-w-xl px-4 py-14">
        <div role="alert" className="rounded-2xl border border-line bg-white p-6">
          <h1 className="font-semibold">We couldn&apos;t load this booking</h1>
          <p className="mt-1 text-sm text-muted">Please refresh in a minute. Your reference is {ref}.</p>
        </div>
      </main>
    );
  }
  if (!booking) notFound();

  // Only the first name goes on the page: anyone holding the link can see it.
  const firstName = booking.fullName.split(' ')[0];

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:py-14">
      <div className="rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">Slot reserved</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">You&apos;re booked, {firstName}.</h1>

        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Service</dt>
            <dd className="mt-1 font-medium">{SERVICES[booking.service]}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">When</dt>
            <dd className="mt-1 font-medium">{istFull(booking.slotStart)} IST · 30 minutes</dd>
            <LocalTime iso={booking.slotStart} />
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Reference</dt>
            <dd className="mt-1 font-mono text-base font-semibold">{booking.ref}</dd>
          </div>
        </dl>

        <a
          href={`/api/booking/${booking.ref}/ics`}
          className="mt-6 inline-block rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          Add to calendar
        </a>

        <div className="mt-8 border-t border-line pt-5 text-sm text-muted">
          <p className="font-semibold text-ink">What happens next</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Keep your reference, it identifies this slot.</li>
            <li>A Cynbit service lead joins at the time above.</li>
            <li>After the call you get a scope of work and next steps.</li>
          </ol>
          <p className="mt-4 text-xs">This is a prototype. No email is sent and no real appointment exists.</p>
        </div>

        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-brand underline">
          Book another call
        </Link>
      </div>
    </main>
  );
}
