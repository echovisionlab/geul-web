import { describe, expect, it } from 'vitest';
import { parseWorkStatus, workStatusSchema } from './schema';

describe('Work status schema', () => {
  it('retains archived as a public read state', () => {
    expect(workStatusSchema.parse('archived')).toBe('archived');
    expect(parseWorkStatus('archived')).toBe('archived');
  });
});
