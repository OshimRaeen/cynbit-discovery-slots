import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-14">
      <div className="rounded-2xl border border-line bg-white p-6">
        <h1 className="font-semibold">We couldn&apos;t find that booking</h1>
        <p className="mt-1 text-sm text-muted">
          Check the reference, or note that demo bookings are deleted after 7 days.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-brand underline">
          Back to booking
        </Link>
      </div>
    </main>
  );
}
