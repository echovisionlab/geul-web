import { createPageBlockFixtureSections, PAGE_BLOCK_TYPES } from '@echovisionlab/geul-common/page';
import { pageBlockManifest } from '@/features/page/blocks/block-manifest';
import { DEFAULT_SECTION_SETTINGS, parseSectionMetaSafe } from '@/features/page/blocks/section-schema';

function flattenSections(
  sections: ReturnType<typeof createPageBlockFixtureSections>,
): Array<(typeof sections)[number]> {
  const flattened: Array<(typeof sections)[number]> = [];

  for (const section of sections) {
    flattened.push(section);

    if (section.type === 'columns' && section.columns) {
      for (const column of section.columns) {
        flattened.push(...flattenSections(column.sections));
      }
    }
  }

  return flattened;
}

describe('page section schema', () => {
  it('keeps the shared block type list in sync with the fixture set', () => {
    expect(createPageBlockFixtureSections().map((section) => section.type)).toEqual([...PAGE_BLOCK_TYPES]);
  });

  it('accepts the current prop shape for every registered block type', () => {
    const sections = flattenSections(createPageBlockFixtureSections());

    for (const section of sections) {
      const parsed = parseSectionMetaSafe(section);

      expect(parsed).not.toBeNull();
      expect(parsed?.type).toBe(section.type);
      expect(parsed?.settings).toEqual({
        ...DEFAULT_SECTION_SETTINGS,
        ...section.settings,
      });
      const expectedProps = { ...(section.props ?? {}) };
      if (section.type === 'map') {
        delete expectedProps.mapPlaceId;
        delete expectedProps.location;
      }
      expect(parsed?.props ?? {}).toMatchObject(expectedProps);
      if (section.type === 'map') {
        expect(parsed?.props).not.toHaveProperty('mapPlaceId');
        expect(parsed?.props).not.toHaveProperty('location');
      }
    }
  });

  it('normalizes legacy map props at the existing page document read boundary', () => {
    const legacyLocation = JSON.stringify({ name: 'Seoul', lat: 37.5665, lng: 126.978 });
    const parsed = parseSectionMetaSafe({
      id: 'legacy-map',
      type: 'map',
      props: { mapPlaceId: 'legacy-place', location: legacyLocation },
    });

    expect(parsed?.props).toMatchObject({
      mapPlaceIds: 'legacy-place',
      centerLat: '37.5665',
      centerLng: '126.978',
    });
    expect(parsed?.props).not.toHaveProperty('mapPlaceId');
    expect(parsed?.props).not.toHaveProperty('location');

    const nested = parseSectionMetaSafe({
      id: 'legacy-columns',
      type: 'columns',
      props: {},
      columns: [
        {
          id: 'column-1',
          sections: [
            {
              id: 'nested-legacy-map',
              type: 'map',
              props: { mapPlaceId: 'nested-place', location: legacyLocation },
            },
          ],
        },
      ],
    });

    expect(nested?.type).toBe('columns');
    if (nested?.type !== 'columns') {
      return;
    }
    expect(nested.columns[0]?.sections[0]?.props).toMatchObject({
      mapPlaceIds: 'nested-place',
      centerLat: '37.5665',
      centerLng: '126.978',
    });
  });

  it('applies the manifest nesting policy when parsing columns', () => {
    for (const [type, definition] of Object.entries(pageBlockManifest)) {
      const nestedSection = {
        id: `nested-${type}`,
        type,
        props: {},
        ...(type === 'columns' ? { columns: [] } : {}),
      };
      const parsed = parseSectionMetaSafe({
        id: `columns-with-${type}`,
        type: 'columns',
        props: {},
        columns: [{ id: 'column-1', sections: [nestedSection] }],
      });

      expect(parsed !== null).toBe(definition.allowNested);
    }
  });

  it('keeps only currently supported props for post-map', () => {
    const section = parseSectionMetaSafe({
      id: 'section-post-map',
      type: 'post-map',
      settings: {},
      props: {
        categoryIds: 'cat-1,cat-2',
        aspectRatio: '1:1',
        previewWidth: '72',
        preferredScheme: 'dark',
        areaLabelsMode: 'show',
        poiLabelsMode: 'hide',
        clickAction: 'open_card',
        limit: '12',
      },
    });

    expect(section).not.toBeNull();
    expect(section?.type).toBe('post-map');
    expect(section?.props).toMatchObject({
      categoryIds: 'cat-1,cat-2',
      aspectRatio: '1:1',
      previewWidth: '72',
      preferredScheme: 'dark',
      areaLabelsMode: 'show',
      poiLabelsMode: 'hide',
    });
    expect(section?.props).not.toHaveProperty('clickAction');
    expect(section?.props).not.toHaveProperty('limit');
  });

  it('keeps only currently supported props for work-map', () => {
    const section = parseSectionMetaSafe({
      id: 'section-work-map',
      type: 'work-map',
      settings: {},
      props: {
        workTypes: 'music_project,portfolio',
        featuredOnly: 'true',
        aspectRatio: '1:1',
        previewWidth: '72',
        preferredScheme: 'dark',
        areaLabelsMode: 'hide',
        poiLabelsMode: 'show',
        requirePlace: 'true',
        categoryIds: 'cat-1',
      },
    });

    expect(section).not.toBeNull();
    expect(section?.type).toBe('work-map');
    expect(section?.props).toMatchObject({
      workTypes: 'music_project,portfolio',
      featuredOnly: 'true',
      aspectRatio: '1:1',
      previewWidth: '72',
      preferredScheme: 'dark',
      areaLabelsMode: 'hide',
      poiLabelsMode: 'show',
    });
    expect(section?.props).not.toHaveProperty('requirePlace');
    expect(section?.props).not.toHaveProperty('categoryIds');
  });

  it('keeps release-list category filters', () => {
    const section = parseSectionMetaSafe({
      id: 'section-release-list',
      type: 'release-list',
      settings: {},
      props: {
        categoryIds: 'cat-1,cat-2',
        artistId: 'artist-1',
        labelId: 'label-1',
        unknownField: 'drop-me',
      },
    });

    expect(section).not.toBeNull();
    expect(section?.type).toBe('release-list');
    expect(section?.props).toMatchObject({
      categoryIds: 'cat-1,cat-2',
      artistId: 'artist-1',
      labelId: 'label-1',
    });
    expect(section?.props).not.toHaveProperty('unknownField');
  });
});
