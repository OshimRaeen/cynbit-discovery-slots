import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);

export const bookingSchema = z.object({
  fullName: z.string().trim().min(2, 'Please enter your name').max(100, 'Name is too long'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, 'Email is too long')
    .email('Please enter a valid email address'),
  service: z.enum(['ai-automation', 'it-services', 'digital-marketing'], {
    errorMap: () => ({ message: 'Please choose a service' }),
  }),
  slot: z.string().datetime({ message: 'Please choose a time slot' }),
  note: text(500)
    .optional()
    .transform((v) => (v ? v : undefined)),
  // An unticked checkbox isn't sent at all; a ticked one arrives as "on".
  consent: z.enum(['on', 'true'], { errorMap: () => ({ message: 'Please agree to continue' }) }),
});

export type BookingInput = z.infer<typeof bookingSchema>;
