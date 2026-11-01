import { SERVICES, type Booking } from './types';

const utc = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// Escape text values the way RFC 5545 asks for.
const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Lines may not run past 75 bytes; longer ones continue on the next line after a space.
export function fold(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = enc.encode(ch).length;
    if (bytes + size > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

export function buildIcs(b: Booking): string {
  const service = SERVICES[b.service];
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cynbit discovery slots prototype//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${b.ref}@discovery-prototype`,
    `DTSTAMP:${utc(b.createdAt)}`,
    `DTSTART:${utc(b.slotStart)}`,
    `DTEND:${utc(b.slotEnd)}`,
    `SUMMARY:${escapeText(`Cynbit discovery call: ${service}`)}`,
    `DESCRIPTION:${escapeText(`Reference ${b.ref}.\nA Cynbit service lead will join this call.\nPrototype booking, not a real appointment.`)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
