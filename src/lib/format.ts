// Formatting helpers. IST is always shown, so the "official" time is never ambiguous.

export function formatInZone(iso: string, timeZone: string | undefined, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-IN', { timeZone, ...opts }).format(new Date(iso));
}

export const istTime = (iso: string) =>
  formatInZone(iso, 'Asia/Kolkata', { hour: 'numeric', minute: '2-digit', hour12: true });

export const istDay = (iso: string) =>
  formatInZone(iso, 'Asia/Kolkata', { weekday: 'short', day: 'numeric', month: 'short' });

export const istFull = (iso: string) =>
  formatInZone(iso, 'Asia/Kolkata', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
