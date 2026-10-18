import { describe, expect, it } from 'vitest';
import { buildWorkFeaturePlaces } from './data';

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
});
