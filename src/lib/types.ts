export const SERVICES = {
  'ai-automation': 'AI automation',
  'it-services': 'Custom IT services',
  'digital-marketing': 'Digital marketing & SEO',
} as const;

export type ServiceId = keyof typeof SERVICES;

export type Booking = {
  ref: string;
  fullName: string;
  email: string;
  service: ServiceId;
  slotStart: string; // UTC ISO
  slotEnd: string; // UTC ISO
  note?: string;
  createdAt: string; // UTC ISO
};
