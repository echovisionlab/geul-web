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

describe('page section padding', () => {
  it('applies stored padding as pixels and leaves unset sides unstyled', () => {
    expect(
      getPageSectionStyle({ paddingTop: '12', paddingBottom: '16', paddingLeft: '20', paddingRight: '24' }),
    ).toMatchObject({ paddingTop: '12px', paddingBottom: '16px', paddingLeft: '20px', paddingRight: '24px' });
    expect(getPageSectionStyle({ paddingTop: '12' })).toMatchObject({
      paddingTop: '12px',
      paddingBottom: undefined,
      paddingLeft: undefined,
      paddingRight: undefined,
    });
  });
});
