'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { bookSlot } from '@/app/actions';
import { SERVICES, type ServiceId } from '@/lib/types';
import { formatInZone, istDay, istTime } from '@/lib/format';

export type DayView = { date: string; slots: { start: string; taken: boolean }[] };

const SERVICE_BLURB: Record<ServiceId, string> = {
  'ai-automation': 'Agents, workflow automation, LLM integrations',
  'it-services': 'Custom development, migration, cloud scaling',
  'digital-marketing': 'Technical SEO and performance marketing',
};

// The visitor's own timezone. Null on the server, so server and first client render match.
function useLocalZone(): string | undefined {
  return useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => undefined,
  );
}

const inputClass =
  'mt-1 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

export default function BookingFlow({ days }: { days: DayView[] }) {
  const router = useRouter();
  const zone = useLocalZone();
  const showLocal = zone !== undefined && zone !== 'Asia/Kolkata';

  const firstOpenDay = days.find((d) => d.slots.some((s) => !s.taken))?.date ?? days[0]?.date;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [service, setService] = useState<ServiceId | null>(null);
  const [dayKey, setDayKey] = useState<string | undefined>(firstOpenDay);
  const [slot, setSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const day = days.find((d) => d.date === dayKey) ?? days[0];
  const localTime = (iso: string) =>
    formatInZone(iso, zone, { hour: 'numeric', minute: '2-digit', hour12: true, weekday: 'short' });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await bookSlot(data);
      if (res.success) {
        router.push(`/booking/${res.ref}`);
        return; // keep the button disabled while we navigate
      }
      if (res.code === 'VALIDATION') setFieldErrors(res.fieldErrors);
      if (res.code === 'SLOT_TAKEN' || res.code === 'SLOT_UNAVAILABLE') {
        // The calendar moved under them: reload availability and send them back to pick again.
        setSlot(null);
        setStep(2);
        router.refresh();
      }
      setError(res.message);
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-3xl border border-line bg-white p-5 shadow-sm sm:p-8">
      <ol className="mb-6 flex gap-2 text-xs font-semibold" aria-label="Progress">
        {['Service', 'Time', 'Details'].map((label, i) => (
          <li
            key={label}
            aria-current={step === i + 1 ? 'step' : undefined}
            className={`rounded-full px-3 py-1 ${step === i + 1 ? 'bg-brand text-white' : 'bg-brand-soft text-brand'}`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {step === 1 && (
        <section>
          <h2 className="text-lg font-semibold">What do you want to talk about?</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(Object.keys(SERVICES) as ServiceId[]).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={service === id}
                onClick={() => setService(id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  service === id ? 'border-brand bg-brand-soft' : 'border-line hover:border-brand'
                }`}
              >
                <span className="block font-semibold">{SERVICES[id]}</span>
                <span className="mt-1 block text-xs text-muted">{SERVICE_BLURB[id]}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!service}
            onClick={() => setStep(2)}
            className="mt-6 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-40"
          >
            Choose a time
          </button>
        </section>
      )}

      {step === 2 && (
        <section>
          <h2 className="text-lg font-semibold">Pick a 30-minute slot</h2>
          <p className="mt-1 text-xs text-muted">
            Times are in India Standard Time (IST){showLocal ? `; your local time is shown underneath` : ''}.
          </p>

          <div role="tablist" aria-label="Day" className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => {
              const open = d.slots.filter((s) => !s.taken).length;
              return (
                <button
                  key={d.date}
                  role="tab"
                  type="button"
                  aria-selected={d.date === day?.date}
                  onClick={() => setDayKey(d.date)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs ${
                    d.date === day?.date ? 'border-brand bg-brand-soft' : 'border-line hover:border-brand'
                  }`}
                >
                  <span className="block font-semibold">{istDay(d.slots[0].start)}</span>
                  <span className="text-muted">{open} open</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {day?.slots.map((s) => (
              <button
                key={s.start}
                type="button"
                disabled={s.taken}
                aria-pressed={slot === s.start}
                onClick={() => setSlot(s.start)}
                className={`rounded-xl border px-2 py-2 text-sm transition ${
                  s.taken
                    ? 'cursor-not-allowed border-line bg-surface text-muted line-through opacity-60'
                    : slot === s.start
                      ? 'border-brand bg-brand text-white'
                      : 'border-line hover:border-brand'
                }`}
              >
                <span className="block font-semibold">{istTime(s.start)}</span>
                {showLocal && <span className="block text-[11px] opacity-80">{localTime(s.start)}</span>}
                {s.taken && <span className="block text-[11px]">taken</span>}
              </button>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="rounded-full border border-line px-5 py-3 text-sm font-semibold">
              Back
            </button>
            <button
              type="button"
              disabled={!slot}
              onClick={() => setStep(3)}
              className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 3 && service && slot && (
        <form onSubmit={onSubmit} noValidate>
          <h2 className="text-lg font-semibold">Almost done</h2>
          <p className="mt-1 text-sm text-muted">
            {SERVICES[service]} on {istDay(slot)} at {istTime(slot)} IST
            {showLocal ? ` (${localTime(slot)} your time)` : ''}.{' '}
            <button type="button" onClick={() => setStep(2)} className="font-semibold text-brand underline">
              Change
            </button>
          </p>

          <input type="hidden" name="service" value={service} />
          <input type="hidden" name="slot" value={slot} />

          {/* Honeypot: invisible to people, tempting to bots. */}
          <div aria-hidden="true" className="absolute -left-[9999px]">
            <label htmlFor="website">Leave this empty</label>
            <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fullName" className="text-xs font-semibold uppercase tracking-wide text-muted">Full name</label>
              <input id="fullName" name="fullName" autoComplete="name" required className={inputClass}
                aria-invalid={!!fieldErrors.fullName} aria-describedby={fieldErrors.fullName ? 'err-fullName' : undefined} />
              {fieldErrors.fullName && <p id="err-fullName" className="mt-1 text-xs text-red-700">{fieldErrors.fullName[0]}</p>}
            </div>
            <div>
              <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted">Work email</label>
              <input id="email" name="email" type="email" autoComplete="email" required className={inputClass}
                aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'err-email' : undefined} />
              {fieldErrors.email && <p id="err-email" className="mt-1 text-xs text-red-700">{fieldErrors.email[0]}</p>}
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="note" className="text-xs font-semibold uppercase tracking-wide text-muted">
              Anything we should know? (optional)
            </label>
            <textarea id="note" name="note" rows={3} maxLength={500} className={inputClass}
              aria-invalid={!!fieldErrors.note} aria-describedby={fieldErrors.note ? 'err-note' : undefined} />
            {fieldErrors.note && <p id="err-note" className="mt-1 text-xs text-red-700">{fieldErrors.note[0]}</p>}
          </div>

          <div className="mt-4">
            <label className="flex items-start gap-3 text-sm text-muted">
              <input type="checkbox" name="consent" className="mt-1" />
              <span>I agree to Cynbit using these details to arrange this call. (Prototype: no real processing happens.)</span>
            </label>
            {fieldErrors.consent && <p className="mt-1 text-xs text-red-700">{fieldErrors.consent[0]}</p>}
          </div>

          <div className="mt-6 flex gap-3">
            <button type="button" onClick={() => setStep(2)} className="rounded-full border border-line px-5 py-3 text-sm font-semibold">
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
            >
              {submitting ? 'Booking…' : 'Reserve this slot'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
