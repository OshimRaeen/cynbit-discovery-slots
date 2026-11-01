import { randomInt } from 'node:crypto';

// No 0/O/1/I/L, so a reference read out over the phone doesn't get misheard.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newRef(): string {
  let out = '';
  for (let i = 0; i < 8; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return `CYN-${out}`;
}

export const REF_PATTERN = /^CYN-[A-HJKMNP-Z2-9]{8}$/;
