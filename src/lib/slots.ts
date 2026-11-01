// Slot generation. Everything is worked out in Indian Standard Time (UTC+5:30, no daylight
// saving), then stored and passed around as plain UTC ISO strings. Showing a slot in the
// visitor's own timezone is the browser's job (see LocalTime).

export const SLOT_MINUTES = 30;
export const LEAD_TIME_HOURS = 4; // can't book something starting in the next 4 hours
export const DAYS_AHEAD = 7; // how many bookable days to offer
const FIRST_HOUR = 10; // first call starts 10:00 IST
const LAST_HOUR = 17; // last call starts 17:30 IST (ends 18:00)
const IST_OFFSET_MIN = 330;

export type Slot = { start: string; end: string };
export type Day = { date: string; slots: Slot[] }; // date is YYYY-MM-DD in IST

const pad = (n: number) => String(n).padStart(2, '0');

// Calendar parts of an instant as seen on a clock in India.
function istParts(d: Date) {
  const t = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), dow: t.getUTCDay() };
}

// The instant when an Indian wall clock shows the given date and time.
function fromIst(y: number, m: number, d: number, hour: number, minute: number) {
  return new Date(Date.UTC(y, m, d, hour, minute) - IST_OFFSET_MIN * 60_000);
}

export function generateSlots(now: Date): Day[] {
  const earliest = now.getTime() + LEAD_TIME_HOURS * 3_600_000;
  const today = istParts(now);
  const days: Day[] = [];

  // Look at up to 30 calendar days so a long weekend can't leave us with nothing.
  for (let offset = 0; offset < 30 && days.length < DAYS_AHEAD; offset++) {
    const p = istParts(fromIst(today.y, today.m, today.d + offset, 12, 0));
    if (p.dow === 0 || p.dow === 6) continue; // no weekend calls

    const slots: Slot[] = [];
    for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour++) {
      for (const minute of [0, 30]) {
        const start = fromIst(p.y, p.m, p.d, hour, minute);
        if (start.getTime() < earliest) continue;
        const end = new Date(start.getTime() + SLOT_MINUTES * 60_000);
        slots.push({ start: start.toISOString(), end: end.toISOString() });
      }
    }
    if (slots.length) days.push({ date: `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`, slots });
  }
  return days;
}

// A slot is only valid if we would have offered it right now. This is what stops someone
// posting an arbitrary timestamp (3 AM, a Sunday, last year) straight at the server.
export function findOfferedSlot(startIso: string, now: Date): Slot | null {
  for (const day of generateSlots(now)) {
    const hit = day.slots.find((s) => s.start === startIso);
    if (hit) return hit;
  }
  return null;
}
