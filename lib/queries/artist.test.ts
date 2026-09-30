import { WorkType as PublicWorkType } from '@echovisionlab/geul-proto/public/work_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getArtistView } from './artist';

const mocks = vi.hoisted(() => ({
  createPublicArtistClientWithAuth: vi.fn(),
  client: {
    get: vi.fn(),
    getWorks: vi.fn(),
    getReleases: vi.fn(),
  },
}));

vi.mock('@/lib/api/server-client', () => ({
  createPublicArtistClientWithAuth: mocks.createPublicArtistClientWithAuth,
}));

vi.mock('@/features/editor/contract/localized-rich-text', () => ({
  materializeLocalizedRichTextTree: vi.fn(() => null),
}));

describe('getArtistView work mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPublicArtistClientWithAuth.mockResolvedValue(mocks.client);
    mocks.client.get.mockResolvedValue({
      artist: { id: 'artist-1', name: 'Artist', isGroup: false },
    });
    mocks.client.getWorks.mockResolvedValue({
      works: [
        PublicWorkType.MUSIC_PROJECT,
        PublicWorkType.PORTFOLIO,
        PublicWorkType.ARTICLE,
        PublicWorkType.CONTRIBUTION,
        PublicWorkType.UNSPECIFIED,
      ].map((type, index) => ({ id: `work-${index + 1}`, title: `Work ${index + 1}`, type })),
    });
    mocks.client.getReleases.mockResolvedValue({ releases: [] });
  });

  it('preserves every public work type and the unspecified fallback', async () => {
    const artist = await getArtistView('artist-1');

    expect(artist?.works.map((work) => work.type)).toEqual([
      'music_project',
      'portfolio',
      'article',
      'contribution',
      'music_project',
    ]);
  });
});
