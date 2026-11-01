import { MongoClient, type Collection } from 'mongodb';
import type { Booking } from './types';
import { DuplicateSlotError, type BookingStore } from './store';

// Demo bookings delete themselves after a week, so nobody's details sit in the demo database.
const DEMO_RETENTION_SECONDS = 7 * 24 * 60 * 60;

type Doc = Omit<Booking, 'slotStart' | 'slotEnd' | 'createdAt'> & {
  slotStart: Date;
  slotEnd: Date;
  createdAt: Date;
};

const globalForMongo = globalThis as unknown as { _mongoClient?: Promise<MongoClient> };

function getClient(uri: string) {
  // Reused across requests so serverless invocations don't open a new connection each time.
  globalForMongo._mongoClient ??= new MongoClient(uri).connect();
  return globalForMongo._mongoClient;
}

const toBooking = (d: Doc): Booking => ({
  ref: d.ref,
  fullName: d.fullName,
  email: d.email,
  service: d.service,
  slotStart: d.slotStart.toISOString(),
  slotEnd: d.slotEnd.toISOString(),
  note: d.note,
  createdAt: d.createdAt.toISOString(),
});

export function createMongoStore(uri: string, dbName = 'cynbit_discovery'): BookingStore {
  let ready: Promise<Collection<Doc>> | undefined;

  const collection = () =>
    (ready ??= (async () => {
      const col = (await getClient(uri)).db(dbName).collection<Doc>('bookings');
      await Promise.all([
        col.createIndex({ slotStart: 1 }, { unique: true }), // the double-booking guard
        col.createIndex({ ref: 1 }, { unique: true }),
        col.createIndex({ email: 1 }),
        col.createIndex({ createdAt: 1 }, { expireAfterSeconds: DEMO_RETENTION_SECONDS }),
      ]);
      return col;
    })());

  return {
    async insert(b) {
      const col = await collection();
      try {
        await col.insertOne({
          ...b,
          slotStart: new Date(b.slotStart),
          slotEnd: new Date(b.slotEnd),
          createdAt: new Date(b.createdAt),
        });
      } catch (err) {
        const e = err as { code?: number; keyPattern?: Record<string, unknown> };
        if (e.code === 11000 && e.keyPattern && 'slotStart' in e.keyPattern) throw new DuplicateSlotError();
        throw err;
      }
    },
    async takenSlots(fromIso, toIso) {
      const col = await collection();
      const docs = await col
        .find({ slotStart: { $gte: new Date(fromIso), $lte: new Date(toIso) } }, { projection: { slotStart: 1 } })
        .toArray();
      return docs.map((d) => d.slotStart.toISOString());
    },
    async findByRef(ref) {
      const col = await collection();
      const d = await col.findOne({ ref });
      return d ? toBooking(d as Doc) : null;
    },
    async findUpcomingByEmail(email, nowIso) {
      const col = await collection();
      const d = await col.findOne({ email, slotStart: { $gt: new Date(nowIso) } });
      return d ? toBooking(d as Doc) : null;
    },
  };
}
