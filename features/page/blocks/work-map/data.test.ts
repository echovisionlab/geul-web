import { describe, expect, it } from 'vitest';
import { buildWorkFeaturePlaces, buildWorkFeatureSourceData } from './data';

describe('work-map data', () => {
  const items = [
    {
      placeId: 'place-1',
      name: 'Seoul',
      address: 'Seoul, South Korea',
      lat: 37.5665,
      lng: 126.978,
      workCount: 2,
      primaryWorkId: 'work-1',
      primaryWorkSlug: 'work-1',
      primaryWorkTitle: 'Work 1',
    },
  ] as const;

  it('uses the primary work title for map callouts', () => {
    const places = buildWorkFeaturePlaces([...items], 'content_title');

    expect(places).toEqual([
      {
        id: 'place-1',
        name: 'Work 1',
        address: 'Seoul, South Korea',
        lat: 37.5665,
        lng: 126.978,
        href: '/works/work-1',
      },
    ]);
  });

  it('can use the place name for map callouts', () => {
    const places = buildWorkFeaturePlaces([...items], 'place_name');

    expect(places).toEqual([
      {
        id: 'place-1',
        name: 'Seoul',
        address: 'Seoul, South Korea',
        lat: 37.5665,
        lng: 126.978,
        href: '/works/work-1',
      },
    ]);
  });

  it('keeps only cluster features in map source data', () => {
    const source = buildWorkFeatureSourceData({
      clusters: [
        {
          id: 'cluster-1',
          lat: 10,
          lng: 20,
          placeCount: 3,
          workCount: 4,
          minBreakoutZoom: null,
          bounds: { west: 19, south: 9, east: 21, north: 11 },
        },
      ],
      items: [
        {
          placeId: 'place-1',
          name: 'Seoul',
          address: 'Seoul, South Korea',
          lat: 37.5665,
          lng: 126.978,
          workCount: 2,
          primaryWorkId: 'work-1',
          primaryWorkSlug: 'work-1',
          primaryWorkTitle: 'Work 1',
        },
      ],
    });

    expect(source.features).toHaveLength(1);
    expect(source.features[0]?.properties).toMatchObject({
      kind: 'cluster',
      id: 'cluster-1',
      count: 3,
    });
  });
});
