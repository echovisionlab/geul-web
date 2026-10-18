import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { ReleaseType } from '@echovisionlab/geul-proto/secure/release_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assetRefFixture } from '@/tests/helpers/asset-ref';
import * as actions from './release';

const mocks = vi.hoisted(() => ({
  createReleaseClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

const releaseClient = vi.hoisted(() => ({
  createRelease: vi.fn(),
  deleteRelease: vi.fn(),
  deleteReleaseArtwork: vi.fn(),
  getRelease: vi.fn(),
  getReleaseRelations: vi.fn(),
  publishRelease: vi.fn(),
  setReleaseArtists: vi.fn(),
  setReleaseArtwork: vi.fn(),
  setReleaseCategories: vi.fn(),
  setReleaseCredits: vi.fn(),
  setReleaseFormats: vi.fn(),
  setReleaseGenres: vi.fn(),
  setReleaseLabels: vi.fn(),
  setReleaseStyles: vi.fn(),
  unpublishRelease: vi.fn(),
  updateRelease: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/lib/api/server-client', () => ({
  createReleaseClient: mocks.createReleaseClient,
}));

describe('release actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createReleaseClient.mockResolvedValue(releaseClient);
    releaseClient.createRelease.mockResolvedValue({ id: 'release-1' });
    releaseClient.getRelease.mockResolvedValue({
      id: 'release-1',
      title: 'Album',
      slug: 'album',
      type: ReleaseType.EP,
      description: 'Description',
      artworkUrl: 'https://cdn.example/art.webp',
      releaseDate: timestampFromDate(new Date('2026-01-01T00:00:00Z')),
      spotifyUrl: 'https://spotify.example',
      appleMusicUrl: undefined,
      bandcampUrl: undefined,
      youtubeMusicUrl: undefined,
      status: 'published',
      publishedAt: timestampFromDate(new Date('2026-01-02T00:00:00Z')),
      createdAt: timestampFromDate(new Date('2025-12-31T00:00:00Z')),
      updatedAt: undefined,
    });
    releaseClient.getReleaseRelations.mockResolvedValue({
      artists: [{ artistId: 'artist-1', artistName: 'Artist One', artistSlug: 'artist-one', sortOrder: 0 }],
      labels: [
        { labelId: 'label-1', labelName: 'Label One', labelSlug: 'label-one', catalogNumber: 'CAT-1', sortOrder: 1 },
      ],
      categories: [{ id: 'category-1', name: 'Category One', slug: 'category-one' }],
      genres: [{ id: 'genre-1', name: 'Genre One', slug: 'genre-one' }],
      styles: [{ id: 'style-1', name: 'Style One', slug: 'style-one' }],
      formats: [{ id: 'format-1', name: 'Vinyl', slug: 'vinyl', formatDescription: 'Gatefold' }],
      credits: [
        {
          id: 'credit-1',
          artistId: 'artist-1',
          artistName: 'Artist One',
          artistSlug: 'artist-one',
          memberId: undefined,
          memberName: undefined,
          creditedName: undefined,
          creditRole: 'Producer',
          sortOrder: 2,
        },
      ],
    });
    releaseClient.setReleaseArtwork.mockResolvedValue({
      artworkAsset: assetRefFixture('https://cdn.example/new-art.webp'),
    });
  });

  it('maps authorized editor relation snapshots into ReleaseEditor items', async () => {
    await expect(actions.getReleaseEditorRelationsAction('release-1')).resolves.toEqual({
      artists: [{ artist_id: 'artist-1', artist_name: 'Artist One', artist_slug: 'artist-one', sort_order: 0 }],
      labels: [
        {
          label_id: 'label-1',
          label_name: 'Label One',
          label_slug: 'label-one',
          catalog_number: 'CAT-1',
          sort_order: 1,
        },
      ],
      categories: [{ id: 'category-1', name: 'Category One', slug: 'category-one' }],
      genres: [{ id: 'genre-1', name: 'Genre One', slug: 'genre-one' }],
      styles: [{ id: 'style-1', name: 'Style One', slug: 'style-one' }],
      formats: [{ id: 'format-1', name: 'Vinyl', slug: 'vinyl', format_description: 'Gatefold' }],
      credits: [
        {
          id: 'credit-1',
          credit_type: 'artist',
          artist_id: 'artist-1',
          artist_name: 'Artist One',
          artist_slug: 'artist-one',
          member_id: null,
          member_name: null,
          credited_name: null,
          credit_role: 'Producer',
          sort_order: 2,
        },
      ],
    });
    expect(releaseClient.getReleaseRelations).toHaveBeenCalledWith({ releaseId: 'release-1' });
  });

  it('uses the generated Release date oneof for set and explicit clear', async () => {
    const releaseDate = new Date('2026-06-01T00:00:00.000Z');

    await expect(actions.updateReleaseFieldsAction('release-1', { releaseDate })).resolves.toEqual({
      ok: true,
      success: true,
    });
    await expect(actions.updateReleaseFieldsAction('release-1', { releaseDate: null })).resolves.toEqual({
      ok: true,
      success: true,
    });

    expect(releaseClient.updateRelease).toHaveBeenNthCalledWith(1, {
      id: 'release-1',
      type: undefined,
      releaseDateChange: { case: 'setReleaseDate', value: timestampFromDate(releaseDate) },
      spotifyUrl: undefined,
      appleMusicUrl: undefined,
      bandcampUrl: undefined,
      youtubeMusicUrl: undefined,
    });
    expect(releaseClient.updateRelease).toHaveBeenNthCalledWith(2, {
      id: 'release-1',
      type: undefined,
      releaseDateChange: { case: 'clearReleaseDate', value: {} },
      spotifyUrl: undefined,
      appleMusicUrl: undefined,
      bandcampUrl: undefined,
      youtubeMusicUrl: undefined,
    });
  });

  it('maps not-found and permission errors to stable action results', async () => {
    releaseClient.getRelease.mockRejectedValueOnce(new ConnectError('missing', Code.NotFound));
    await expect(actions.getReleaseAdminAction('missing')).resolves.toBeNull();

    releaseClient.publishRelease.mockRejectedValueOnce(new ConnectError('missing', Code.NotFound));
    await expect(actions.publishReleaseAction('missing')).resolves.toEqual({
      ok: false,
      error: 'Release not found',
      errorCode: Code.NotFound,
    });

    releaseClient.setReleaseArtwork.mockRejectedValueOnce(new ConnectError('denied', Code.PermissionDenied));
    await expect(actions.setReleaseArtworkAction('release-1', 'file-1')).resolves.toEqual({
      ok: false,
      error: 'No permission to edit this release',
      errorCode: Code.PermissionDenied,
    });

    releaseClient.updateRelease.mockRejectedValueOnce(new ConnectError('private database detail', Code.Internal));
    await expect(actions.updateReleaseSlugAction('release-1', 'slug')).resolves.toEqual({
      ok: false,
      error: 'Failed to update slug',
      errorCode: Code.Internal,
    });
  });

  it('rejects release relation writes without an observed baseline', async () => {
    await expect(actions.setReleaseCategoriesAction('release-1', ['category-1'], undefined as never)).resolves.toEqual({
      ok: false,
      error: 'An observed category snapshot is required',
      errorCode: Code.InvalidArgument,
    });
    expect(releaseClient.setReleaseCategories).not.toHaveBeenCalled();
  });

  it('maps observed relation snapshots and stable reorder anchors', async () => {
    await actions.setReleaseCategoriesAction('release-1', ['category-1', 'category-2'], ['category-1']);
    expect(releaseClient.setReleaseCategories).toHaveBeenCalledWith({
      releaseId: 'release-1',
      categoryIds: ['category-1', 'category-2'],
      observed: { ids: ['category-1'] },
    });

    await actions.setReleaseLabelsAction(
      'release-1',
      [{ labelId: 'label-1', catalogNumber: 'new', sortOrder: 0 }],
      [{ labelId: 'label-1', catalogNumber: 'old', sortOrder: 0 }],
      { itemId: 'label-1', previousItemId: 'label-0' },
    );
    expect(releaseClient.setReleaseLabels).toHaveBeenLastCalledWith({
      releaseId: 'release-1',
      labels: [{ labelId: 'label-1', catalogNumber: 'new', sortOrder: 0 }],
      observed: { labels: [{ labelId: 'label-1', catalogNumber: 'old', sortOrder: 0 }] },
      orderIntent: { itemId: 'label-1', previousItemId: 'label-0' },
    });

    await actions.setReleaseCreditsAction(
      'release-1',
      [{ id: 'credit-1', creditedName: 'New', sortOrder: 0 }],
      [{ id: 'credit-1', creditedName: 'Old', sortOrder: 0 }],
      { itemId: 'credit-1', nextItemId: 'credit-2' },
    );
    expect(releaseClient.setReleaseCredits).toHaveBeenLastCalledWith({
      releaseId: 'release-1',
      credits: [
        {
          id: 'credit-1',
          artistId: undefined,
          memberId: undefined,
          creditedName: 'New',
          creditRole: undefined,
          sortOrder: 0,
        },
      ],
      observed: {
        credits: [
          {
            id: 'credit-1',
            artistId: undefined,
            memberId: undefined,
            creditedName: 'Old',
            creditRole: undefined,
            sortOrder: 0,
          },
        ],
      },
      orderIntent: { itemId: 'credit-1', nextItemId: 'credit-2' },
    });
  });
});
