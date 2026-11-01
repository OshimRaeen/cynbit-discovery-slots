import { describe, it, expect } from 'vitest';
import { buildIcs, fold } from '../src/lib/ics';
import type { Booking } from '../src/lib/types';

const booking: Booking = {
  ref: 'CYN-ABCD2345',
  fullName: 'Asha Verma',
  email: 'asha@example.com',
  service: 'ai-automation',
  slotStart: '2026-11-03T05:30:00.000Z',
  slotEnd: '2026-11-03T06:00:00.000Z',
  createdAt: '2026-11-02T09:15:30.000Z',
};

describe('buildIcs', () => {
  const ics = buildIcs(booking);

  it('is a well-formed calendar with CRLF line endings', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/); // every newline is preceded by \r
  });

  it('writes start and end in UTC', () => {
    expect(ics).toContain('DTSTART:20261103T053000Z');
    expect(ics).toContain('DTEND:20261103T060000Z');
    expect(ics).toContain('DTSTAMP:20261102T091530Z');
  });

  it('carries the reference as a stable UID', () => {
    expect(ics).toContain('UID:CYN-ABCD2345@discovery-prototype');
  });

  it('does not leak the visitor\'s email address', () => {
    expect(ics).not.toContain('asha@example.com');
  });

  it('escapes commas and newlines in text fields', () => {
    expect(ics).toContain('\\n'); // newline in DESCRIPTION is escaped
    expect(ics).not.toMatch(/DESCRIPTION:[^\r]*\r?\n[^ \r]/); // and no raw newline inside it
  });
});

describe('fold', () => {
  it('leaves short lines alone', () => {
    expect(fold('SUMMARY:short')).toBe('SUMMARY:short');
  });

  it('wraps long lines at 75 bytes with a leading space on continuations', () => {
    const folded = fold('X:' + 'a'.repeat(200));
    const lines = folded.split('\r\n');
    expect(lines.length).toBeGreaterThan(1);
    expect(new TextEncoder().encode(lines[0]).length).toBeLessThanOrEqual(75);
    for (const l of lines.slice(1)) {
      expect(l.startsWith(' ')).toBe(true);
      expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    }
    expect(lines.map((l, i) => (i ? l.slice(1) : l)).join('')).toBe('X:' + 'a'.repeat(200));
  });

  it('never splits a multi-byte character', () => {
    const folded = fold('X:' + 'é'.repeat(100));
    expect(folded.split('\r\n').map((l, i) => (i ? l.slice(1) : l)).join('')).toBe('X:' + 'é'.repeat(100));
  });
});
