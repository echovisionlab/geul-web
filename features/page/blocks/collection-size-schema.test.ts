import { describe, expect, it } from 'vitest';
import { pageSectionCatalog } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { COLLECTION_SIZES, DEFAULT_COLLECTION_SIZE } from '@/components/core/Collection/collection-contract';
import { pageBlockManifest } from './block-manifest';
import { parseSectionMeta } from './section-schema';

const collectionBlockTypes = [
  'artist-list',
  'label-list',
  'author-list',
  'post-list',
  'release-list',
  'work-list',
  'program-event-list',
] as const;

describe.each(collectionBlockTypes)('%s collection size schema', (type) => {
  it('uses the same sizes and default as the canonical shared storage contract', () => {
    const field = pageSectionCatalog[type].fields.itemSize;
    expect(field).toMatchObject({
      type: 'enum',
      values: [...COLLECTION_SIZES],
      default: DEFAULT_COLLECTION_SIZE,
      ownership: 'shared',
    });
  });

  it('renders existing blocks at the system default size', () => {
    expect(pageBlockManifest[type].schema.parse({}).itemSize).toBe(DEFAULT_COLLECTION_SIZE);
  });

  it.each(COLLECTION_SIZES)('preserves %s through page section parsing', (itemSize) => {
    const section = parseSectionMeta({ id: 'collection-section', type, props: { itemSize } });
    expect(section.props).toMatchObject({ itemSize });
  });

  it('rejects values outside the system size contract', () => {
    expect(pageBlockManifest[type].schema.safeParse({ itemSize: 'xl' }).success).toBe(false);
  });
});
