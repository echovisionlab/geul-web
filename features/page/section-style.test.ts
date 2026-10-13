import { describe, expect, it } from 'vitest';
import { sectionSettingsSchema } from './blocks/section-base-schema';
import { getPageSectionStyle } from './section-style';

describe('page section width', () => {
  it('keeps the existing widths and defaults unchanged', () => {
    expect(getPageSectionStyle({})).toMatchObject({ maxWidth: '100%', marginLeft: undefined });
    expect(getPageSectionStyle({ maxWidth: 'full' })).toMatchObject({ maxWidth: '100%', marginLeft: undefined });
    expect(getPageSectionStyle({ maxWidth: 'container' })).toMatchObject({ maxWidth: '1200px', marginLeft: 'auto' });
    expect(getPageSectionStyle({ maxWidth: 'narrow' })).toMatchObject({ maxWidth: '800px', marginRight: 'auto' });
    expect(sectionSettingsSchema.parse({}).maxWidth).toBe('full');
  });

  it('accepts only the stored widths', () => {
    expect(sectionSettingsSchema.safeParse({ maxWidth: 'reading' }).success).toBe(false);
  });
});
