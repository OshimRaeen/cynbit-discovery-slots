import { createMemoryStore, type BookingStore } from './store';
import { createMongoStore } from './mongoStore';

const g = globalThis as unknown as { _bookingStore?: BookingStore };

export function getStore(): BookingStore {
  if (g._bookingStore) return g._bookingStore;

  const uri = process.env.MONGODB_URI;
  if (uri) {
    g._bookingStore = createMongoStore(uri, process.env.MONGODB_DB || undefined);
  } else if (process.env.NODE_ENV !== 'production') {
    // Local development without a database: bookings live in memory until the server restarts.
    g._bookingStore = createMemoryStore();
  } else {
    // On a real deployment, silently falling back to memory would lose bookings. Fail loudly.
    throw new Error('MONGODB_URI is not set');
  }
  return g._bookingStore;
}
