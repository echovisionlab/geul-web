import { describe, expect, it } from 'vitest';
import { buildPostFeaturePlaces } from './data';

describe('post-map data', () => {
  const items = [
    {
      placeId: 'place-1',
      name: 'Seoul',
      address: 'Seoul, South Korea',
      lat: 37.5665,
      lng: 126.978,
      postCount: 2,
      primaryPostId: 'post-1',
      primaryPostSlug: 'post-1',
      primaryPostTitle: 'Post 1',
    },
  ] as const;

  it('uses the post title for callouts when configured', () => {
    expect(buildPostFeaturePlaces([...items], 'content_title')).toEqual([
      {
        id: 'place-1',
        name: 'Post 1',
        address: 'Seoul, South Korea',
        lat: 37.5665,
        lng: 126.978,
        href: '/posts/post-1',
      },
    ]);
  });

  it('can use the place name for callouts', () => {
    expect(buildPostFeaturePlaces([...items], 'place_name')).toEqual([
      {
        id: 'place-1',
        name: 'Seoul',
        address: 'Seoul, South Korea',
        lat: 37.5665,
        lng: 126.978,
        href: '/posts/post-1',
      },
    ]);
  });
});
