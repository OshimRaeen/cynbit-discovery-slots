import { describe, it, expect } from 'vitest';
import { generateSlots, findOfferedSlot, DAYS_AHEAD } from '../src/lib/slots';

// Helper: an instant given as an Indian wall-clock time.
const ist = (iso: string) => new Date(new Date(iso + 'Z').getTime() - 330 * 60_000);

describe('generateSlots', () => {
  it('offers 16 half-hour slots on a full day, 10:00 to 17:30 IST', () => {
    const days = generateSlots(ist('2026-11-02T08:00:00')); // Monday 08:00 IST
    const tuesday = days[1];
    expect(tuesday.date).toBe('2026-11-03');
    expect(tuesday.slots).toHaveLength(16);
    expect(tuesday.slots[0].start).toBe(ist('2026-11-03T10:00:00').toISOString());
    expect(tuesday.slots[15].start).toBe(ist('2026-11-03T17:30:00').toISOString());
    expect(tuesday.slots[15].end).toBe(ist('2026-11-03T18:00:00').toISOString());
  });

  it('hides anything starting inside the 4 hour lead time', () => {
    const days = generateSlots(ist('2026-11-02T10:00:00')); // Monday 10:00 IST
    // earliest bookable is 14:00 IST
    expect(days[0].slots[0].start).toBe(ist('2026-11-02T14:00:00').toISOString());
    expect(days[0].slots).toHaveLength(8);
  });

  it('skips today entirely when the lead time swallows every slot', () => {
    const days = generateSlots(ist('2026-11-02T15:00:00')); // last slot 17:30 < 19:00
    expect(days[0].date).toBe('2026-11-03');
  });

  it('never offers Saturdays or Sundays', () => {
    const days = generateSlots(ist('2026-11-06T20:00:00')); // Friday evening
    expect(days[0].date).toBe('2026-11-09'); // straight to Monday
    for (const d of days) {
      const dow = new Date(d.date + 'T12:00:00Z').getUTCDay();
      expect([0, 6]).not.toContain(dow);
    }
  });

  it('returns the requested number of days', () => {
    expect(generateSlots(ist('2026-11-02T08:00:00'))).toHaveLength(DAYS_AHEAD);
  });

  it('uses the Indian date, not the UTC date, near midnight', () => {
    // 20:00 UTC on Sunday 1 Nov is already 01:30 IST on Monday 2 Nov.
    const days = generateSlots(new Date('2026-11-01T20:00:00Z'));
    expect(days[0].date).toBe('2026-11-02');
    expect(days[0].slots[0].start).toBe(ist('2026-11-02T10:00:00').toISOString());
  });
});

describe('findOfferedSlot', () => {
  const now = ist('2026-11-02T08:00:00');

  it('accepts a slot we offered', () => {
    expect(findOfferedSlot(ist('2026-11-03T11:30:00').toISOString(), now)).not.toBeNull();
  });

  it('rejects a time outside working hours', () => {
    expect(findOfferedSlot(ist('2026-11-03T03:00:00').toISOString(), now)).toBeNull();
  });

  it('rejects a time that is not on a half-hour boundary', () => {
    expect(findOfferedSlot(ist('2026-11-03T11:10:00').toISOString(), now)).toBeNull();
  });

  it('rejects a weekend', () => {
    expect(findOfferedSlot(ist('2026-11-07T11:00:00').toISOString(), now)).toBeNull();
  });

  it('rejects the past and the far future', () => {
    expect(findOfferedSlot(ist('2026-10-30T11:00:00').toISOString(), now)).toBeNull();
    expect(findOfferedSlot(ist('2027-03-01T11:00:00').toISOString(), now)).toBeNull();
  });
});
