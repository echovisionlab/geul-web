import { describe, expect, it } from 'vitest';
import { mergeMetadataPatches } from './merge-metadata-patches';

describe('mergeMetadataPatches', () => {
  it('keeps the earliest observed value and latest desired value for a repeated key', () => {
    const merged = mergeMetadataPatches(
      { title: 'first edit', observed: { title: 'server baseline' } },
      { title: 'latest edit', observed: { title: 'first edit' } },
    );

    expect(merged).toEqual({
      title: 'latest edit',
      observed: { title: 'server baseline' },
    });
  });

  it('preserves the first observed value for existing keys and adds baselines for new keys', () => {
    const merged = mergeMetadataPatches(
      { title: 'local title', observed: { title: 'title baseline' } },
      {
        summary: 'local summary',
        observed: { title: 'intermediate title', summary: 'summary baseline' },
      },
    );

    expect(merged).toEqual({
      title: 'local title',
      summary: 'local summary',
      observed: { title: 'title baseline', summary: 'summary baseline' },
    });
  });
});
