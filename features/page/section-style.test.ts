import { describe, expect, it } from 'vitest';
import { sectionSettingsSchema } from './blocks/section-base-schema';

describe('page section width', () => {
  it('accepts only the stored widths', () => {
    expect(sectionSettingsSchema.safeParse({ maxWidth: 'reading' }).success).toBe(false);
  });
});
