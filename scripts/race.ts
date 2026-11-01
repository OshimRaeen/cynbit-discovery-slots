// Fires many bookings for the SAME slot at the same moment and checks that exactly one wins.
//
//   npm run race
//
// With MONGODB_URI set (in .env.local) it runs against your real MongoDB, using a throwaway
// database, so it tests the unique index and not just the code. Without it, it runs in memory.

import { MongoClient } from 'mongodb';
import { handleBooking } from '../src/lib/booking';
import { createMemoryStore } from '../src/lib/store';
import { createMongoStore } from '../src/lib/mongoStore';
import { FixedWindowLimiter } from '../src/lib/rateLimit';
import { generateSlots } from '../src/lib/slots';

try {
  process.loadEnvFile('.env.local');
} catch {
  // no .env.local, that's fine
}

const ATTEMPTS = 25;
const RACE_DB = 'cynbit_discovery_race';

async function main() {
  const uri = process.env.MONGODB_URI;
  const store = uri ? createMongoStore(uri, RACE_DB) : createMemoryStore({ jitterMs: 5 });
  console.log(uri ? 'Using MongoDB (throwaway database)' : 'Using the in-memory store (no MONGODB_URI found)');

  const slot = generateSlots(new Date())[1].slots[0].start;
  const limiter = new FixedWindowLimiter({ limit: 1000, windowMs: 60_000 });

  const results = await Promise.all(
    Array.from({ length: ATTEMPTS }, (_, i) => {
      const fd = new FormData();
      fd.set('fullName', `Racer ${i}`);
      fd.set('email', `racer${i}@example.com`);
      fd.set('service', 'ai-automation');
      fd.set('slot', slot);
      fd.set('consent', 'on');
      return handleBooking(fd, { ip: `10.0.0.${i}`, limiter, store });
    }),
  );

  const won = results.filter((r) => r.success).length;
  const taken = results.filter((r) => !r.success && r.code === 'SLOT_TAKEN').length;
  const other = ATTEMPTS - won - taken;
  console.log(`${ATTEMPTS} simultaneous attempts for ${slot}`);
  console.log(`  booked: ${won}   slot taken: ${taken}   other: ${other}`);

  if (uri) {
    const client = new MongoClient(uri);
    await client.connect();
    await client.db(RACE_DB).dropDatabase();
    await client.close();
    console.log('Throwaway database removed.');
  }

  if (won !== 1 || other !== 0) {
    console.error('FAIL: expected exactly one booking and no other outcomes');
    process.exit(1);
  }
  console.log('PASS: exactly one booking won.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
