import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { ConnectError } from '@connectrpc/connect';
import { FileDownloadAction, FileDownloadAvailability } from '@echovisionlab/geul-proto/public/file_pb.ts';
import {
  ReleaseStatus as PublicReleaseStatus,
  ReleaseType as PublicReleaseType,
} from '@echovisionlab/geul-proto/public/release_pb.ts';
import { ReleaseType } from '@echovisionlab/geul-proto/secure/release_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mediaDeliveryFixture } from '@/tests/helpers/media-delivery';
import { assetRefFixture } from '@/tests/helpers/asset-ref';
import * as queries from './release';

const mocks = vi.hoisted(() => ({
  createPublicReleaseClient: vi.fn(),
  createPublicReleaseClientWithAuth: vi.fn(),
  createReleaseClient: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}));

const releaseClient = vi.hoisted(() => ({
  listReleasesAdmin: vi.fn(),
}));

const publicReleaseClient = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createPublicReleaseClient: mocks.createPublicReleaseClient,
  createPublicReleaseClientWithAuth: mocks.createPublicReleaseClientWithAuth,
  createReleaseClient: mocks.createReleaseClient,
}));

vi.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({ error: mocks.loggerError, warn: mocks.loggerWarn }),
}));

const date = timestampFromDate(new Date('2026-01-01T00:00:00Z'));

function publicRelease(overrides: Record<string, unknown> = {}) {
  return {
    id: 'release-1',
    title: 'Release',
    slug: undefined,
    type: PublicReleaseType.EP,
    description: 'Description',
    descriptionHtml: '<p>Description</p>',
    artworkUrl: undefined,
    catalogNumber: undefined,
    releaseDate: date,
    publishedAt: date,
    status: PublicReleaseStatus.PUBLISHED,
    spotifyUrl: undefined,
    appleMusicUrl: undefined,
    bandcampUrl: undefined,
    youtubeMusicUrl: undefined,
    ogImageUrl: undefined,
    labels: [{ id: 'label-1', name: 'Label', slug: undefined, catalogNumber: undefined }],
    genres: [{ id: 'genre-1', name: 'Genre', slug: undefined }],
    styles: [{ id: 'style-1', name: 'Style', slug: undefined }],
    formats: [{ id: 'format-1', name: 'Vinyl', slug: undefined, description: undefined }],
    credits: [
      {
        id: 'credit-1',
        name: 'Guest',
        slug: undefined,
        creditRole: undefined,
        artistId: undefined,
        memberId: 'member-1',
        imageUrl: undefined,
        note: undefined,
      },
    ],
    artists: [{ id: 'artist-1', name: 'Artist', slug: undefined, imageUrl: undefined, role: 'main' }],
    tracks: [
      {
        id: 'track-1',
        title: 'Track',
        trackNumber: 1,
        discNumber: undefined,
        durationMs: undefined,
        delivery: mediaDeliveryFixture({
          fileId: 'file-track-1',
          fileName: 'field-recording.wav',
          playbackUrl: 'https://cdn.example/track/master.m3u8',
          waveformUrl: 'https://cdn.example/waveform.json',
          spectrogramUrl: 'https://cdn.example/spectrogram.webp',
        }),
        downloadAvailability: FileDownloadAvailability.AVAILABLE,
        downloadAction: FileDownloadAction.DOWNLOAD,
        credits: [
          {
            id: 'track-credit-1',
            name: undefined,
            creditRole: 'Producer',
            artist: {
              id: 'artist-1',
              name: 'Artist',
              slug: undefined,
              imageUrl: undefined,
              role: 'main',
            },
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('release queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createReleaseClient.mockResolvedValue(releaseClient);
    mocks.createPublicReleaseClient.mockReturnValue(publicReleaseClient);
    mocks.createPublicReleaseClientWithAuth.mockResolvedValue(publicReleaseClient);
    releaseClient.listReleasesAdmin.mockResolvedValue({
      releases: [
        {
          release: {
            id: 'release-1',
            title: 'Release',
            slug: undefined,
            type: ReleaseType.COMPILATION,
            artworkUrl: undefined,
            status: 'RELEASE_STATUS_PUBLISHED',
            releaseDate: date,
            createdAt: date,
            updatedAt: undefined,
          },
          trackCount: 2,
          creditCount: 3,
        },
      ],
      pagination: { total: 1 },
    });
    publicReleaseClient.list.mockResolvedValue({
      releases: [publicRelease()],
      pagination: { total: 1 },
    });
    publicReleaseClient.get.mockResolvedValue({ release: publicRelease() });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue([0, 0.5, 1]),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps admin and public release lists', async () => {
    await expect(
      queries.listReleasesAdmin({
        page: 2,
        pageSize: 5,
        search: 'release',
        status: 'published',
        type: 'compilation',
        labelId: 'label-1',
        sort: [{ field: 'title', order: 'desc' }],
      }),
    ).resolves.toMatchObject({
      data: [{ id: 'release-1', type: 'compilation', trackCount: 2, creditCount: 3 }],
      total: 1,
      page: 2,
    });

    await expect(
      queries.listPublishedReleases({
        types: ['ep'],
        categoryIds: ['cat-1'],
        artistId: 'artist-1',
        labelId: 'label-1',
        requestedLocale: 'ko',
        sortBy: 'release_date',
        sortOrder: 'asc',
      }),
    ).resolves.toMatchObject({
      releases: [{ id: 'release-1', type: 'ep', artists: [{ id: 'artist-1', slug: null }] }],
      pagination: { total: 1, limit: 20, offset: 0 },
    });
  });

  it('maps public release detail including tracks and waveform sidecars', async () => {
    await expect(
      queries.getReleasePublic('release-1', 'token', {
        requestedLocale: 'ko',
        sharePassword: 'secret',
      }),
    ).resolves.toMatchObject({
      id: 'release-1',
      type: 'ep',
      status: 'published',
      labels: [{ id: 'label-1', slug: null }],
      tracks: [
        {
          id: 'track-1',
          fileId: 'file-track-1',
          fileName: 'field-recording.wav',
          downloadAvailability: FileDownloadAvailability.AVAILABLE,
          downloadAction: FileDownloadAction.DOWNLOAD,
          waveformData: [0, 0.5, 1],
          credits: [{ id: 'track-credit-1', artist: { id: 'artist-1' } }],
        },
      ],
    });

    expect(publicReleaseClient.get).toHaveBeenCalledWith({
      slug: 'release-1',
      shareToken: 'token',
      sharePassword: 'secret',
    });
  });

  it('maps Release OG from artwork and ignores a stale generated asset', async () => {
    const artworkAsset = assetRefFixture('https://cdn.example/release-artwork.webp');
    const staleGeneratedOg = assetRefFixture('https://cdn.example/stale-release-og.webp');
    publicReleaseClient.list.mockResolvedValueOnce({
      releases: [publicRelease({ artworkAsset, ogAsset: staleGeneratedOg })],
      pagination: { total: 1 },
    });
    publicReleaseClient.get.mockResolvedValueOnce({
      release: publicRelease({ artworkAsset, ogAsset: staleGeneratedOg }),
    });

    await expect(queries.listPublishedReleases({})).resolves.toMatchObject({
      releases: [
        {
          artworkUrl: 'https://cdn.example/release-artwork.webp',
          ogImageUrl: 'https://cdn.example/release-artwork.webp',
        },
      ],
    });
    await expect(queries.getReleasePublic('release-1')).resolves.toMatchObject({
      artworkUrl: 'https://cdn.example/release-artwork.webp',
      ogImageUrl: 'https://cdn.example/release-artwork.webp',
    });
  });

  it('returns empty/null responses for handled failures', async () => {
    releaseClient.listReleasesAdmin.mockRejectedValueOnce(new Error('offline'));
    await expect(queries.listReleasesAdmin({})).resolves.toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });

    publicReleaseClient.get.mockRejectedValueOnce(new ConnectError('unavailable'));
    await expect(queries.getReleasePublic('missing')).resolves.toBeNull();
  });
});
