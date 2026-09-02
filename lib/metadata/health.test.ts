import { describe, expect, it } from 'vitest';
import { buildMetadataHealthChecks, METADATA_HEALTH_CHECKS } from './health';

describe('buildMetadataHealthChecks', () => {
  it('returns no warnings for valid concise metadata', () => {
    expect(
      buildMetadataHealthChecks({
        effectiveTitle: 'Signal Mesh',
        effectiveDescription: 'A calm summary for search and social previews.',
      }),
    ).toEqual([]);
  });

  it('warns when description is missing', () => {
    expect(
      buildMetadataHealthChecks({
        effectiveTitle: 'Signal Mesh',
        effectiveDescription: '',
      }),
    ).toContain(METADATA_HEALTH_CHECKS.missingDescription);
  });

  it('warns for long title and description', () => {
    expect(
      buildMetadataHealthChecks({
        effectiveTitle: 'A very long metadata title that will almost certainly overflow search and social previews',
        effectiveDescription:
          'This description is intentionally long so that it will exceed the usual search and social preview limits and trigger a truncation warning for the metadata health checks utility.',
      }),
    ).toEqual([METADATA_HEALTH_CHECKS.longTitle, METADATA_HEALTH_CHECKS.longDescription]);
  });
});
