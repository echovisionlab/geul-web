import { describe, expect, it } from 'vitest';
import { resolvePageResidentMetadata } from './collaboration-mode';

describe('resolvePageResidentMetadata', () => {
  it('preserves explicit empty target fields instead of falling back to source', () => {
    expect(
      resolvePageResidentMetadata({
        roomLocale: 'en',
        bootstrapLocale: 'en',
        localeMetadata: { title: '', summary: '' },
        fallbackTitle: '원문 제목',
        fallbackSummary: '원문 요약',
      }),
    ).toEqual({ title: '', summary: '' });
  });

  it('uses fallback only when the exact room metadata field is absent', () => {
    expect(
      resolvePageResidentMetadata({
        roomLocale: 'en',
        bootstrapLocale: 'en',
        localeMetadata: {},
        fallbackTitle: 'Source title',
        fallbackSummary: 'Source summary',
      }),
    ).toEqual({ title: 'Source title', summary: 'Source summary' });
  });
});
