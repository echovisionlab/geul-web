import { isConnectError, isConnectErrorCode } from '@/lib/api/connect-error';
import { create } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import {
  FilterOp,
  FilterSpecSchema,
  SortSpecSchema,
  type SortOrder,
} from '@echovisionlab/geul-proto/common/common_pb.ts';
import { ReleaseStatus as PublicReleaseStatus } from '@echovisionlab/geul-proto/public/release_pb.ts';
import { ReleaseType } from '@echovisionlab/geul-proto/secure/release_pb.ts';
import {
  createPublicReleaseClient,
  createPublicReleaseClientWithAuth,
  createReleaseClient,
} from '@/lib/api/server-client';
import {
  materializeLocalizedRichTextTree,
  type LocalizedRichTextBlock,
} from '@/features/editor/contract/localized-rich-text';
import { localizedRichTextPlainText } from '@/features/editor/contract/localized-rich-text-text';
import {
  mapPublicLocalizationInfo,
  maybeFetchSourceLocale,
  type PublicLocalizationInfoLike,
} from '@/lib/queries/localized-public';
import {
  publicReleaseTypeToString,
  releaseTypeToString,
  stringToPublicReleaseType,
  stringToReleaseType,
} from '@/lib/types/release/proto';
import { parseReleaseStatus } from '@/lib/types/release/schema';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('release-queries');

interface ReleaseListInput {
  filter?: unknown;
  filterBy?: 'AND' | 'OR';
  sort?: { field: string; order?: 'asc' | 'desc' }[];
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  type?: string;
  labelId?: string;
}

function stringToManageReleaseStatus(status?: string): string | undefined {
  switch (status) {
    case 'draft':
      return 'RELEASE_STATUS_DRAFT';
    case 'published':
      return 'RELEASE_STATUS_PUBLISHED';
    default:
      return undefined;
  }
}

function publicReleaseStatusToString(status: PublicReleaseStatus): 'draft' | 'published' | 'unknown' {
  switch (status) {
    case PublicReleaseStatus.DRAFT:
      return 'draft';
    case PublicReleaseStatus.PUBLISHED:
      return 'published';
    default:
      return 'unknown';
  }
}

// Admin: list releases with stats
export async function listReleasesAdmin(input: ReleaseListInput) {
  try {
    const client = await createReleaseClient();
    const limit = input.pageSize ?? 20;
    const page = input.page ?? 1;
    const offset = (page - 1) * limit;

    const sorts = input.sort?.map((s) => ({
      field: s.field,
      order: (s.order === 'desc' ? 2 : 1) as SortOrder,
    }));

    const filters = [];
    if (input.status) {
      const normalizedStatus = stringToManageReleaseStatus(input.status);
      if (normalizedStatus) {
        filters.push(
          create(FilterSpecSchema, {
            field: 'status',
            op: FilterOp.EQ,
            value: normalizedStatus,
          }),
        );
      }
    }
    const releaseType = stringToReleaseType(input.type);
    if (releaseType !== ReleaseType.UNSPECIFIED) {
      filters.push(create(FilterSpecSchema, { field: 'type', op: FilterOp.EQ, value: String(releaseType) }));
    }
    if (input.labelId) {
      filters.push(create(FilterSpecSchema, { field: 'label_id', op: FilterOp.EQ, value: input.labelId }));
    }

    if (input.search) {
      filters.push(create(FilterSpecSchema, { field: 'search', op: FilterOp.ILIKE, value: input.search }));
    }
    const response = await client.listReleasesAdmin({
      pagination: { limit, offset },
      filters,
      sorts,
    });

    const total = response.pagination?.total ?? 0;

    return {
      data: (response.releases ?? []).map((rws) => ({
        id: rws.release?.id ?? '',
        title: rws.release?.title ?? '',
        slug: rws.release?.slug ?? null,
        type: releaseTypeToString(rws.release?.type ?? ReleaseType.ALBUM),
        artworkUrl: rws.release?.artworkAsset?.url ?? null,
        status: parseReleaseStatus(rws.release?.status),
        releaseDate: rws.release?.releaseDate ? timestampDate(rws.release.releaseDate) : null,
        trackCount: rws.trackCount,
        creditCount: rws.creditCount,
        createdAt: rws.release?.createdAt ? timestampDate(rws.release.createdAt) : null,
        updatedAt: rws.release?.updatedAt ? timestampDate(rws.release.updatedAt) : null,
      })),
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    logger.error('Failed to list releases admin', { error: err });
    return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }
}

// Public: list published releases (uses public API - no auth required)
export async function listPublishedReleases(input: {
  types?: ('album' | 'ep' | 'single' | 'compilation')[];
  categoryIds?: string[];
  artistId?: string;
  labelId?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'title' | 'release_date' | 'published_at';
  sortOrder?: 'asc' | 'desc';
  requestedLocale?: string | null;
}) {
  try {
    const client = input.requestedLocale
      ? await createPublicReleaseClientWithAuth(input.requestedLocale)
      : createPublicReleaseClient();
    const filters = [];
    if (input.types && input.types.length > 0) {
      filters.push(
        create(FilterSpecSchema, {
          field: 'type',
          op: FilterOp.IN,
          values: input.types.map((t) => String(stringToPublicReleaseType(t))),
        }),
      );
    }
    if (input.artistId) {
      filters.push(create(FilterSpecSchema, { field: 'artist_id', op: FilterOp.EQ, value: input.artistId }));
    }
    if (input.categoryIds && input.categoryIds.length > 0) {
      filters.push(
        create(FilterSpecSchema, {
          field: 'category_id',
          op: FilterOp.IN,
          values: input.categoryIds,
        }),
      );
    }
    if (input.labelId) {
      filters.push(create(FilterSpecSchema, { field: 'label_id', op: FilterOp.EQ, value: input.labelId }));
    }
    const limit = input.limit ?? 20;
    const offset = input.offset ?? 0;
    const response = await client.list({
      pagination: { limit, offset },
      filters,
      sorts: input.sortBy
        ? [
            create(SortSpecSchema, {
              field: input.sortBy,
              order: (input.sortOrder === 'asc' ? 1 : 2) as SortOrder,
            }),
          ]
        : undefined,
    });

    return {
      releases: (response.releases ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug ?? null,
        type: publicReleaseTypeToString(r.type),
        ogImageUrl: r.artworkAsset?.url ?? null,
        artworkUrl: r.artworkAsset?.url ?? null,
        releaseDate: r.releaseDate ? timestampDate(r.releaseDate) : null,
        publishedAt: r.publishedAt ? timestampDate(r.publishedAt) : null,
        artists: (r.artists ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          slug: a.slug ?? null,
          role: a.role,
          imageUrl: a.imageAsset?.url ?? null,
        })),
      })),
      pagination: {
        total: response.pagination?.total ?? 0,
        limit,
        offset,
      },
    };
  } catch (err) {
    logger.error('Failed to list published releases', { error: err });
    return {
      releases: [],
      pagination: {
        total: 0,
        limit: input.limit ?? 20,
        offset: input.offset ?? 0,
      },
    };
  }
}

export interface PublicRelease {
  id: string;
  title: string;
  slug: string | null;
  type: 'album' | 'ep' | 'single' | 'compilation';
  descriptionText: string | null;
  content: readonly LocalizedRichTextBlock[] | null;
  artworkUrl: string | null;
  catalogNumber: string | null;
  releaseDate: Date | null;
  publishedAt: Date | null;
  status: 'draft' | 'published' | 'unknown';
  spotifyUrl: string | null;
  appleMusicUrl: string | null;
  bandcampUrl: string | null;
  youtubeMusicUrl: string | null;
  ogImageUrl: string | null;
  localizationInfo?: PublicLocalizationInfoLike | null;
  labels: {
    id: string;
    name: string;
    slug: string | null;
    catalogNumber: string | null;
  }[];
  genres: {
    id: string;
    name: string;
    slug: string | null;
  }[];
  styles: {
    id: string;
    name: string;
    slug: string | null;
  }[];
  formats: {
    id: string;
    name: string;
    slug: string | null;
    description: string | null;
  }[];
  credits: {
    id: string;
    name: string;
    slug: string | null;
    creditRole: string | null;
    artistId: string | null;
    memberId: string | null;
    imageUrl: string | null;
    note: string | null;
  }[];
  artists: {
    id: string;
    name: string;
    slug: string | null;
    imageUrl: string | null;
    role: string;
  }[];
  tracks: {
    id: string;
    title: string;
    trackNumber: number;
    discNumber: number | null;
    durationMs: number | null;
    fileId: string | null;
    fileName: string | null;
    hlsUrl: string | null;
    downloadUrl: string | null;
    downloadExpiresAt: string | null;
    waveformUrl: string | null;
    spectrogramUrl: string | null;
    waveformData?: number[] | number[][];
    downloadAvailability: import('@echovisionlab/geul-proto/public/file_pb.ts').FileDownloadAvailability;
    downloadAction: import('@echovisionlab/geul-proto/public/file_pb.ts').FileDownloadAction;
    credits: {
      id: string;
      name: string | null;
      creditRole: string | null;
      artist: {
        id: string;
        name: string;
        slug: string | null;
        imageUrl: string | null;
        role: string;
      } | null;
    }[];
  }[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseWaveformPayload(payload: unknown): number[] | number[][] | undefined {
  if (!Array.isArray(payload) || payload.length === 0) {
    return undefined;
  }

  if (payload.every(isFiniteNumber)) {
    return payload;
  }

  if (payload.every((item) => Array.isArray(item) && item.length > 0 && item.every((value) => isFiniteNumber(value)))) {
    return payload as number[][];
  }

  return undefined;
}

async function fetchWaveformData(url?: string | null): Promise<number[] | number[][] | undefined> {
  if (!url) {
    return undefined;
  }

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return undefined;
    }

    return parseWaveformPayload(await response.json());
  } catch (error) {
    logger.warn('Failed to fetch release track waveform sidecar', { data: { url }, error });
    return undefined;
  }
}

export async function getReleasePublic(
  idOrSlug: string,
  shareToken?: string,
  options?: {
    preferSourceLocale?: boolean;
    requestedLocale?: string | null;
    sharePassword?: string;
    hydrateWaveformData?: boolean;
  },
): Promise<PublicRelease | null> {
  try {
    const client = await createPublicReleaseClientWithAuth(options?.requestedLocale);
    const initialResponse = await client.get({
      slug: decodeURIComponent(idOrSlug),
      shareToken,
      sharePassword: options?.sharePassword,
    });
    const response = await maybeFetchSourceLocale({
      preferSourceLocale: options?.preferSourceLocale,
      initialResponse,
      entity: initialResponse.release ?? null,
      fetchWithLocale: async (locale) => {
        const sourceClient = await createPublicReleaseClientWithAuth(locale);
        return sourceClient.get({
          slug: decodeURIComponent(idOrSlug),
          shareToken,
          sharePassword: options?.sharePassword,
        });
      },
    });
    if (!response.release) {
      return null;
    }

    const release = response.release;
    const content = release.document ? materializeLocalizedRichTextTree(release.document) : null;
    const releaseTracks = release.tracks ?? [];
    const waveformDataByTrackId = new Map<string, number[] | number[][]>();

    if (options?.hydrateWaveformData !== false) {
      await Promise.all(
        releaseTracks.map(async (track) => {
          const waveformData = await fetchWaveformData(track.delivery?.waveform?.url ?? null);
          if (waveformData?.length) {
            waveformDataByTrackId.set(track.id, waveformData);
          }
        }),
      );
    }

    return {
      id: release.id,
      title: release.title,
      slug: release.slug ?? null,
      type: publicReleaseTypeToString(release.type),
      descriptionText: content ? localizedRichTextPlainText(content) || null : null,
      content,
      artworkUrl: release.artworkAsset?.url ?? null,
      catalogNumber: release.catalogNumber ?? null,
      releaseDate: release.releaseDate ? timestampDate(release.releaseDate) : null,
      publishedAt: release.publishedAt ? timestampDate(release.publishedAt) : null,
      status: publicReleaseStatusToString(release.status),
      spotifyUrl: release.spotifyUrl ?? null,
      appleMusicUrl: release.appleMusicUrl ?? null,
      bandcampUrl: release.bandcampUrl ?? null,
      youtubeMusicUrl: release.youtubeMusicUrl ?? null,
      ogImageUrl: release.artworkAsset?.url ?? null,
      localizationInfo: mapPublicLocalizationInfo(release.localizationInfo),
      labels: (release.labels ?? []).map((label) => ({
        id: label.id,
        name: label.name,
        slug: label.slug ?? null,
        catalogNumber: label.catalogNumber ?? null,
      })),
      genres: (release.genres ?? []).map((genre) => ({
        id: genre.id,
        name: genre.name,
        slug: genre.slug ?? null,
      })),
      styles: (release.styles ?? []).map((style) => ({
        id: style.id,
        name: style.name,
        slug: style.slug ?? null,
      })),
      formats: (release.formats ?? []).map((format) => ({
        id: format.id,
        name: format.name,
        slug: format.slug ?? null,
        description: format.description ?? null,
      })),
      credits: (release.credits ?? []).map((credit) => ({
        id: credit.id,
        name: credit.name,
        slug: credit.slug ?? null,
        creditRole: credit.creditRole ?? null,
        artistId: credit.artistId ?? null,
        memberId: credit.memberId ?? null,
        imageUrl: credit.imageAsset?.url ?? null,
        note: credit.note ?? null,
      })),
      artists: (release.artists ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug ?? null,
        imageUrl: a.imageAsset?.url ?? null,
        role: a.role,
      })),
      tracks: releaseTracks.map((track) => ({
        id: track.id,
        title: track.title,
        trackNumber: track.trackNumber,
        discNumber: track.discNumber ?? null,
        durationMs: track.durationMs ?? null,
        fileId: track.delivery?.fileId || null,
        fileName: track.delivery?.fileName ?? null,
        hlsUrl: track.delivery?.playback?.url ?? null,
        downloadUrl: track.delivery?.download?.url ?? null,
        downloadExpiresAt: track.delivery?.download?.expiresAt
          ? timestampDate(track.delivery.download.expiresAt).toISOString()
          : null,
        waveformUrl: track.delivery?.waveform?.url ?? null,
        spectrogramUrl: track.delivery?.spectrogram?.url ?? null,
        waveformData: waveformDataByTrackId.get(track.id),
        downloadAvailability: track.downloadAvailability,
        downloadAction: track.downloadAction,
        credits: (track.credits ?? []).map((credit) => ({
          id: credit.id,
          name: credit.name ?? null,
          creditRole: credit.creditRole ?? null,
          artist: credit.artist
            ? {
                id: credit.artist.id,
                name: credit.artist.name,
                slug: credit.artist.slug ?? null,
                imageUrl: credit.artist.imageAsset?.url ?? null,
                role: credit.artist.role,
              }
            : null,
        })),
      })),
    };
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('GetReleasePublic RPC error', { error: err.message });
    }
    return null;
  }
}

/** Resolve a Release UUID-or-slug for the canonical editor route without hydrating media. */
export async function resolveReleaseIdForEdit(idOrSlug: string): Promise<string | null> {
  try {
    const client = await createPublicReleaseClientWithAuth();
    const response = await client.get({ slug: decodeURIComponent(idOrSlug) });
    return response.release?.id ?? null;
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound, Code.PermissionDenied)) {
      return null;
    }
    throw err;
  }
}
