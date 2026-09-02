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
    releaseClient.setReleaseArtwork.mockResolvedValue({
      artworkAsset: assetRefFixture('https://cdn.example/new-art.webp'),
    });
  });

  it('maps release CRUD, status, and slug actions', async () => {
    await expect(actions.createReleaseAction({ title: 'Single', type: 'single' })).resolves.toEqual({
      data: { id: 'release-1' },
    });
    await expect(actions.getReleaseAdminAction('release-1')).resolves.toMatchObject({
      id: 'release-1',
      type: 'ep',
      spotifyUrl: 'https://spotify.example',
    });
    await expect(actions.publishReleaseAction('release-1')).resolves.toEqual({ success: true });
    await expect(actions.unpublishReleaseAction('release-1')).resolves.toEqual({ success: true });
    await expect(actions.updateReleaseSlugAction('release-1', ' New Slug ')).resolves.toEqual({
      success: true,
      slug: ' New Slug ',
    });
    await expect(actions.deleteReleaseAction('release-1')).resolves.toEqual({ success: true });

    expect(releaseClient.createRelease).toHaveBeenCalledWith({
      title: 'Single',
      type: ReleaseType.SINGLE,
    });
    expect(releaseClient.updateRelease).toHaveBeenCalledWith({
      id: 'release-1',
      slug: ' New Slug ',
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/releases');
  });

  it('maps artwork and release relationship actions', async () => {
    await expect(actions.setReleaseArtworkAction('release-1', 'file-1')).resolves.toEqual({
      url: 'https://cdn.example/new-art.webp',
    });
    await expect(actions.deleteReleaseArtworkAction('release-1')).resolves.toEqual({
      success: true,
    });
    await expect(
      actions.setReleaseLabelsAction('release-1', [{ labelId: 'label-1', catalogNumber: 'CAT-1', sortOrder: 2 }]),
    ).resolves.toEqual({ success: true });
    await expect(actions.setReleaseGenresAction('release-1', ['genre-1'])).resolves.toEqual({
      success: true,
    });
    await expect(
      actions.setReleaseArtistsAction('release-1', [{ artistId: 'artist-1', sortOrder: 0 }]),
    ).resolves.toEqual({ success: true });
    await expect(actions.setReleaseCategoriesAction('release-1', ['cat-1'])).resolves.toEqual({
      success: true,
    });
    await expect(actions.setReleaseStylesAction('release-1', ['style-1'])).resolves.toEqual({
      success: true,
    });
    await expect(
      actions.setReleaseFormatsAction('release-1', [{ formatId: 'format-1', formatDescription: 'Gatefold' }]),
    ).resolves.toEqual({ success: true });
    await expect(
      actions.setReleaseCreditsAction('release-1', [
        {
          id: 'credit-1',
          artistId: null,
          memberId: 'member-1',
          creditedName: 'Guest',
          creditRole: 'Vocals',
          sortOrder: 1,
        },
      ]),
    ).resolves.toEqual({ success: true });

    expect(releaseClient.setReleaseLabels).toHaveBeenCalledWith({
      releaseId: 'release-1',
      labels: [{ labelId: 'label-1', catalogNumber: 'CAT-1', sortOrder: 2 }],
    });
    expect(releaseClient.setReleaseCredits).toHaveBeenCalledWith({
      releaseId: 'release-1',
      credits: [
        {
          id: 'credit-1',
          artistId: undefined,
          memberId: 'member-1',
          creditedName: 'Guest',
          creditRole: 'Vocals',
          sortOrder: 1,
        },
      ],
    });
  });

  it('uses the generated Release date oneof for set and explicit clear', async () => {
    const releaseDate = new Date('2026-06-01T00:00:00.000Z');

    await expect(actions.updateReleaseFieldsAction('release-1', { releaseDate })).resolves.toEqual({ success: true });
    await expect(actions.updateReleaseFieldsAction('release-1', { releaseDate: null })).resolves.toEqual({
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
      error: 'Release not found',
    });

    releaseClient.setReleaseArtwork.mockRejectedValueOnce(new ConnectError('denied', Code.PermissionDenied));
    await expect(actions.setReleaseArtworkAction('release-1', 'file-1')).resolves.toEqual({
      error: 'No permission to edit this release',
    });

    releaseClient.updateRelease.mockRejectedValueOnce(new ConnectError('private database detail', Code.Internal));
    await expect(actions.updateReleaseSlugAction('release-1', 'slug')).resolves.toEqual({
      error: 'Failed to update slug',
    });
  });
});
