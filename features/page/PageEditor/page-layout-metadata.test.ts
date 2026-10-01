import { describe, expect, it } from 'vitest';
import { DEFAULT_DOCUMENT_LAYOUT } from '@/features/document-layout';
import { applyPageLayoutMetadataUpdate } from './page-layout-metadata';

describe('applyPageLayoutMetadataUpdate', () => {
  it('merges a canonical partial layout update into the current layout', () => {
    const current = { ...DEFAULT_DOCUMENT_LAYOUT, pageChrome: 'pinned' as const };

    expect(
      applyPageLayoutMetadataUpdate(current, {
        documentLayout: { contentHeight: 'DOCUMENT_CONTENT_HEIGHT_VIEWPORT' },
      }),
    ).toEqual({ ...current, contentHeight: 'viewport' });
  });

  it('accepts a flattened changed-field update', () => {
    expect(
      applyPageLayoutMetadataUpdate(DEFAULT_DOCUMENT_LAYOUT, {
        'documentLayout.footer': 'DOCUMENT_REGION_PLACEMENT_PINNED',
      }),
    ).toEqual({ ...DEFAULT_DOCUMENT_LAYOUT, footer: 'pinned' });
  });

  it('ignores invalid enum values and unrelated metadata', () => {
    expect(
      applyPageLayoutMetadataUpdate(DEFAULT_DOCUMENT_LAYOUT, {
        documentLayout: { contentHeight: 'DOCUMENT_CONTENT_HEIGHT_UNSPECIFIED' },
        title: 'unrelated',
      }),
    ).toBe(DEFAULT_DOCUMENT_LAYOUT);
    expect(applyPageLayoutMetadataUpdate(DEFAULT_DOCUMENT_LAYOUT, { title: 'unrelated' })).toBe(
      DEFAULT_DOCUMENT_LAYOUT,
    );
  });
});
