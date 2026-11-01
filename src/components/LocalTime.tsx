'use client';

import { useSyncExternalStore } from 'react';
import { formatInZone } from '@/lib/format';

// Shows a time in the visitor's own timezone once the browser has told us what it is.
export default function LocalTime({ iso }: { iso: string }) {
  const zone = useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => undefined,
  );
  if (!zone || zone === 'Asia/Kolkata') return null;
  const text = formatInZone(iso, zone, {
    weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short',
  });
  return <p className="mt-1 text-sm text-muted">Your time: {text}</p>;
}
