import { isConnectError, isConnectErrorCode } from '@/lib/api/connect-error';
import { create } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { FilterOp, FilterSpecSchema, type SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { createLabelClient, createPublicLabelClientWithAuth } from '@/lib/api/server-client';
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
import { createLogger } from '@/lib/utils/logger';
import { themedAssetRefUrl } from '@/lib/utils/asset-ref';

const logger = createLogger('label-queries');

// ============================================
// Server Component queries for Label domain
// ============================================

interface LabelListInput {
  filter?: unknown;
  filterBy?: 'AND' | 'OR';
  sort?: { field: string; order?: 'asc' | 'desc' }[];
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

export async function listLabelsAdmin(input: LabelListInput) {
  try {
    const client = await createLabelClient();
    const limit = input.pageSize ?? 20;
    const page = input.page ?? 1;
    const offset = (page - 1) * limit;

    const sorts = input.sort?.map((s) => ({
      field: s.field,
      order: (s.order === 'desc' ? 2 : 1) as SortOrder,
    }));

    const filters = [];
    if (input.status) {
      filters.push(create(FilterSpecSchema, { field: 'status', op: FilterOp.EQ, value: input.status }));
    }
    if (input.search) {
      filters.push(create(FilterSpecSchema, { field: 'search', op: FilterOp.ILIKE, value: input.search }));
    }
    const response = await client.listLabelsAdmin({
      pagination: { limit, offset },
      filters,
      sorts,
    });

    const total = response.pagination?.total ?? 0;

    return {
      data: (response.labels ?? []).map((lws) => ({
        id: lws.label?.id ?? '',
        name: lws.label?.name ?? '',
        slug: lws.label?.slug ?? null,
        imageUrl: themedAssetRefUrl(lws.label?.imageLightAsset, lws.label?.imageDarkAsset),
        imageLightUrl: lws.label?.imageLightAsset?.url ?? null,
        imageDarkUrl: lws.label?.imageDarkAsset?.url ?? null,
        status: lws.label?.status ?? 'draft',
        artistCount: lws.artistCount,
        releaseCount: lws.releaseCount,
        createdAt: lws.label?.createdAt ? timestampDate(lws.label.createdAt) : null,
        updatedAt: lws.label?.updatedAt ? timestampDate(lws.label.updatedAt) : null,
      })),
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    logger.error('Failed to list labels admin', { error: err });
    return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }
}

export interface LabelArtist {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
}

export interface LabelRelease {
  id: string;
  title: string;
  slug: string | null;
  type: string;
  artworkUrl: string | null;
  releaseDate: Date | null;
  publishedAt: Date | null;
  artists: { id: string; name: string; slug: string | null }[];
}

export async function getLabelAdmin(id: string) {
  try {
    const client = await createLabelClient();
    const response = await client.getLabelEditorData({ id });
    const label = response.label;
    if (!label) {
      return null;
    }

    return {
      id: label.id,
      name: label.name,
      slug: label.slug ?? null,
      document: label.document ?? null,
      countryCode: label.countryCode ?? null,
      website: label.website ?? null,
      imageUrl: themedAssetRefUrl(label.imageLightAsset, label.imageDarkAsset),
      imageLightUrl: label.imageLightAsset?.url ?? null,
      imageDarkUrl: label.imageDarkAsset?.url ?? null,
      socialLinks: label.socialLinks ?? {},
      parentLabelId: label.parentLabelId ?? null,
      status: label.status,
      publishedAt: label.publishedAt ? timestampDate(label.publishedAt) : null,
      createdAt: label.createdAt ? timestampDate(label.createdAt) : null,
      updatedAt: label.updatedAt ? timestampDate(label.updatedAt) : null,
      allowedActions: response.allowedActions,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    if (isConnectErrorCode(err, Code.PermissionDenied)) {
      return null;
    }
    throw err;
  }
}

/**
 * Resolve a canonical Label editor route and prove current edit authority.
 * The public read resolves UUID-or-slug and the editor-data contract returns
 * not-found for both missing and unauthorized Labels.
 */
export async function getLabelForEdit(idOrSlug: string) {
  try {
    const publicClient = await createPublicLabelClientWithAuth();
    const response = await publicClient.get({ slug: decodeURIComponent(idOrSlug) });
    const label = response.label;
    if (!label) {
      return null;
    }

    return getLabelAdmin(label.id);
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound, Code.PermissionDenied)) {
      return null;
    }
    throw err;
  }
}

export interface PublicLabel {
  id: string;
  name: string;
  slug: string | null;
  descriptionText: string | null;
  content: readonly LocalizedRichTextBlock[] | null;
  ogImageUrl: string | null;
  imageUrl: string | null;
  imageLightUrl: string | null;
  imageDarkUrl: string | null;
  website: string | null;
  countryCode: string | null;
  socialLinks: Record<string, string>;
  status: string;
  releaseCount: number;
  artistCount: number;
  parentLabel: {
    id: string;
    name: string;
    slug: string | null;
    ogImageUrl: string | null;
    imageUrl: string | null;
    imageLightUrl: string | null;
    imageDarkUrl: string | null;
  } | null;
  artists: LabelArtist[];
  releases: LabelRelease[];
  createdAt: Date | null;
  updatedAt: Date | null;
  publishedAt: Date | null;
  localizationInfo: PublicLocalizationInfoLike | null;
}

export async function getLabelPublic(
  idOrSlug: string,
  shareToken?: string,
  options?: { preferSourceLocale?: boolean; requestedLocale?: string | null; sharePassword?: string },
): Promise<PublicLabel | null> {
  try {
    const client = await createPublicLabelClientWithAuth(options?.requestedLocale);
    let response = await client.get({ slug: idOrSlug, shareToken, sharePassword: options?.sharePassword });
    response = await maybeFetchSourceLocale({
      preferSourceLocale: options?.preferSourceLocale,
      initialResponse: response,
      entity: response.label ?? null,
      fetchWithLocale: async (locale) => {
        const sourceClient = await createPublicLabelClientWithAuth(locale);
        return sourceClient.get({ slug: idOrSlug, shareToken, sharePassword: options?.sharePassword });
      },
    });

    if (!response.label) {
      return null;
    }

    const label = response.label;
    const content = label.document ? materializeLocalizedRichTextTree(label.document) : null;
    return {
      id: label.id,
      name: label.name,
      slug: label.slug ?? null,
      descriptionText: content ? localizedRichTextPlainText(content) || null : null,
      content,
      ogImageUrl: label.ogAsset?.url ?? null,
      imageUrl: themedAssetRefUrl(label.imageLightAsset, label.imageDarkAsset),
      imageLightUrl: label.imageLightAsset?.url ?? null,
      imageDarkUrl: label.imageDarkAsset?.url ?? null,
      website: label.website ?? null,
      countryCode: label.countryCode ?? null,
      socialLinks: label.socialLinks,
      status: label.status === 1 ? 'draft' : label.status === 2 ? 'published' : 'unknown',
      releaseCount: label.releaseCount,
      artistCount: label.artistCount,
      parentLabel: label.parentLabel
        ? {
            id: label.parentLabel.id,
            name: label.parentLabel.name,
            slug: label.parentLabel.slug ?? null,
            ogImageUrl: label.parentLabel.ogAsset?.url ?? null,
            imageUrl: themedAssetRefUrl(label.parentLabel.imageLightAsset, label.parentLabel.imageDarkAsset),
            imageLightUrl: label.parentLabel.imageLightAsset?.url ?? null,
            imageDarkUrl: label.parentLabel.imageDarkAsset?.url ?? null,
          }
        : null,
      artists: (label.artists ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug ?? null,
        imageUrl: a.imageAsset?.url ?? null,
      })),
      releases: (label.releases ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug ?? null,
        type: r.type,
        artworkUrl: r.artworkAsset?.url ?? null,
        releaseDate: r.releaseDate ? timestampDate(r.releaseDate) : null,
        publishedAt: r.publishedAt ? timestampDate(r.publishedAt) : null,
        artists: (r.artists ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          slug: a.slug ?? null,
        })),
      })),
      createdAt: label.createdAt ? timestampDate(label.createdAt) : null,
      updatedAt: label.updatedAt ? timestampDate(label.updatedAt) : null,
      publishedAt: label.publishedAt ? timestampDate(label.publishedAt) : null,
      localizationInfo: mapPublicLocalizationInfo(label.localizationInfo),
    };
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('GetLabelPublic RPC error', { error: err.message });
    }
    return null;
  }
}
