import { describe, it, expect, beforeEach } from 'vitest';
import { handleBooking, HONEYPOT_FIELD } from '../src/lib/booking';
import { createMemoryStore, DuplicateSlotError, type BookingStore } from '../src/lib/store';
import { FixedWindowLimiter } from '../src/lib/rateLimit';
import { generateSlots } from '../src/lib/slots';
import { REF_PATTERN } from '../src/lib/ref';

// Monday 2 Nov 2026, 08:00 IST
const NOW = new Date(new Date('2026-11-02T08:00:00Z').getTime() - 330 * 60_000);
const days = generateSlots(NOW);
const slotA = days[1].slots[0].start; // Tue 10:00 IST
const slotB = days[1].slots[1].start; // Tue 10:30 IST
const slotC = days[2].slots[3].start;

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const valid = (over: Record<string, string> = {}) => ({
  fullName: 'Asha Verma',
  email: 'asha@example.com',
  service: 'ai-automation',
  slot: slotA,
  note: 'We want to automate order follow-ups.',
  consent: 'on',
  ...over,
});

let store: BookingStore;
let limiter: FixedWindowLimiter;
const run = (fields: Record<string, string>, opts: { ip?: string; store?: BookingStore } = {}) =>
  handleBooking(form(fields), { ip: opts.ip ?? '1.1.1.1', limiter, store: opts.store ?? store, now: NOW });

beforeEach(() => {
  store = createMemoryStore();
  limiter = new FixedWindowLimiter({ limit: 50, windowMs: 60_000, now: () => NOW.getTime() });
});

describe('a normal booking', () => {
  it('succeeds and returns a reference in the expected format', async () => {
    const res = await run(valid());
    expect(res.success).toBe(true);
    if (res.success) expect(res.ref).toMatch(REF_PATTERN);
  });

  it('saves the booking so it can be found by reference', async () => {
    const res = await run(valid());
    if (!res.success) throw new Error('expected success');
    const saved = await store.findByRef(res.ref);
    expect(saved).toMatchObject({ fullName: 'Asha Verma', email: 'asha@example.com', service: 'ai-automation', slotStart: slotA });
  });

  it('lowercases and trims the email, and drops a blank note', async () => {
    const res = await run(valid({ email: '  ASHA@Example.COM ', note: '' }));
    if (!res.success) throw new Error('expected success');
    const saved = await store.findByRef(res.ref);
    expect(saved?.email).toBe('asha@example.com');
    expect(saved?.note).toBeUndefined();
  });
});

describe('double booking', () => {
  it('refuses a second booking for the same slot', async () => {
    await run(valid());
    const res = await run(valid({ email: 'ravi@example.com' }));
    expect(res).toMatchObject({ success: false, code: 'SLOT_TAKEN' });
  });

  it('lets exactly one of 20 simultaneous requests win the same slot', async () => {
    const racing = createMemoryStore({ jitterMs: 5 });
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => run(valid({ email: `person${i}@example.com` }), { store: racing })),
    );
    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(results.filter((r) => !r.success && r.code === 'SLOT_TAKEN')).toHaveLength(19);
  });

  it('lets different slots be booked at the same time', async () => {
    const racing = createMemoryStore({ jitterMs: 5 });
    const slots = [slotA, slotB, slotC];
    const results = await Promise.all(
      slots.map((slot, i) => run(valid({ slot, email: `person${i}@example.com` }), { store: racing })),
    );
    expect(results.every((r) => r.success)).toBe(true);
  });

  it('memory store reports a duplicate the way the database would', async () => {
    const s = createMemoryStore();
    const b = { ref: 'CYN-AAAAAAAA', fullName: 'A B', email: 'a@b.co', service: 'ai-automation' as const, slotStart: slotA, slotEnd: slotB, createdAt: NOW.toISOString() };
    await s.insert(b);
    await expect(s.insert({ ...b, ref: 'CYN-BBBBBBBB' })).rejects.toBeInstanceOf(DuplicateSlotError);
  });
});

describe('one upcoming call per email', () => {
  it('rejects a second booking from the same email', async () => {
    await run(valid());
    const res = await run(valid({ slot: slotC }));
    expect(res).toMatchObject({ success: false, code: 'ALREADY_BOOKED' });
  });

  it('treats the same email in different letter case as the same person', async () => {
    await run(valid());
    const res = await run(valid({ slot: slotC, email: 'ASHA@example.com' }));
    expect(res).toMatchObject({ success: false, code: 'ALREADY_BOOKED' });
  });
});

describe('slot checks', () => {
  it('rejects a time we never offered', async () => {
    const res = await run(valid({ slot: '2026-11-03T21:30:00.000Z' }));
    expect(res).toMatchObject({ success: false, code: 'SLOT_UNAVAILABLE' });
  });

  it('rejects a slot inside the lead time', async () => {
    const tooSoon = new Date(NOW.getTime() + 60 * 60_000).toISOString();
    const res = await run(valid({ slot: tooSoon }));
    expect(res).toMatchObject({ success: false, code: 'SLOT_UNAVAILABLE' });
  });

  it('rejects text that is not a date at all', async () => {
    const res = await run(valid({ slot: 'tomorrow-ish' }));
    expect(res).toMatchObject({ success: false, code: 'VALIDATION' });
  });
});

describe('validation', () => {
  it('lists every missing field', async () => {
    const res = await run({});
    expect(res).toMatchObject({ success: false, code: 'VALIDATION' });
    if (!res.success && res.code === 'VALIDATION') {
      expect(Object.keys(res.fieldErrors).sort()).toEqual(['consent', 'email', 'fullName', 'service', 'slot']);
    }
  });

  it('requires consent', async () => {
    const res = await run(valid({ consent: '' }));
    expect(res).toMatchObject({ success: false, code: 'VALIDATION' });
  });

  it('rejects an unknown service', async () => {
    const res = await run(valid({ service: 'hacking' }));
    expect(res).toMatchObject({ success: false, code: 'VALIDATION' });
  });

  it('rejects a malformed email', async () => {
    const res = await run(valid({ email: 'nope' }));
    expect(res).toMatchObject({ success: false, code: 'VALIDATION' });
  });

  it('caps the note at 500 characters', async () => {
    expect(await run(valid({ note: 'a'.repeat(501) }))).toMatchObject({ success: false, code: 'VALIDATION' });
    expect((await run(valid({ note: 'a'.repeat(500), email: 'x@example.com' }))).success).toBe(true);
  });

  it('ignores fields it does not know about', async () => {
    const res = await run(valid({ isAdmin: 'true' }));
    expect(res.success).toBe(true);
  });
});

describe('abuse controls', () => {
  it('honeypot: looks successful but stores nothing', async () => {
    const res = await run(valid({ [HONEYPOT_FIELD]: 'https://spam.example' }));
    expect(res.success).toBe(true);
    expect(await store.takenSlots('2026-01-01T00:00:00Z', '2027-12-31T00:00:00Z')).toHaveLength(0);
  });

  it('rate limit: blocks an address that keeps trying', async () => {
    limiter = new FixedWindowLimiter({ limit: 3, windowMs: 60_000, now: () => NOW.getTime() });
    for (let i = 0; i < 3; i++) await run(valid({ email: `p${i}@example.com`, slot: days[1].slots[i].start }));
    const res = await run(valid({ email: 'p9@example.com', slot: days[1].slots[9].start }));
    expect(res).toMatchObject({ success: false, code: 'RATE_LIMITED' });
  });

  it('rate limit: counts each address separately', async () => {
    limiter = new FixedWindowLimiter({ limit: 1, windowMs: 60_000, now: () => NOW.getTime() });
    await run(valid(), { ip: '1.1.1.1' });
    const res = await run(valid({ email: 'other@example.com', slot: slotB }), { ip: '2.2.2.2' });
    expect(res.success).toBe(true);
  });
});

describe('when the database fails', () => {
  it('comes back as a result instead of throwing', async () => {
    const broken: BookingStore = {
      ...createMemoryStore(),
      insert: async () => {
        throw new Error('connection reset');
      },
    };
    const res = await run(valid(), { store: broken });
    expect(res).toMatchObject({ success: false, code: 'FAILED' });
  });
});
