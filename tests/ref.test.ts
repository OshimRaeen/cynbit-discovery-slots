import { describe, it, expect } from 'vitest';
import { newRef, REF_PATTERN } from '../src/lib/ref';

describe('newRef', () => {
  it('matches the public format and avoids look-alike characters', () => {
    for (let i = 0; i < 500; i++) {
      const ref = newRef();
      expect(ref).toMatch(REF_PATTERN);
      expect(ref.slice(4)).not.toMatch(/[01OIL]/);
    }
  });

  it('does not repeat across a few thousand draws', () => {
    const seen = new Set(Array.from({ length: 5000 }, newRef));
    expect(seen.size).toBe(5000);
  });
});
