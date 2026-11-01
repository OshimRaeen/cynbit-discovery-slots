import { REF_PATTERN } from '@/lib/ref';
import { getStore } from '@/lib/getStore';
import { buildIcs } from '@/lib/ics';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  if (!REF_PATTERN.test(ref)) return new Response('Not found', { status: 404 });

  try {
    const booking = await getStore().findByRef(ref);
    if (!booking) return new Response('Not found', { status: 404 });

    return new Response(buildIcs(booking), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="cynbit-discovery-${booking.ref}.ics"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response('Temporarily unavailable', { status: 503 });
  }
}
