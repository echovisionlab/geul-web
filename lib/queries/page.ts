import { throwQueryError } from '@/lib/api/query-error';
import { isConnectError, isConnectErrorCode } from '@/lib/api/connect-error';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { FilterOp, SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { PageAccessReason } from '@echovisionlab/geul-proto/common/page_access_pb.ts';
import { fromProtoPageAccessPolicy } from '@/lib/types/page-access';
import { PageStatus as PublicPageStatus } from '@echovisionlab/geul-proto/public/page_pb.ts';
import { PageStatus } from '@echovisionlab/geul-proto/secure/page_pb.ts';
import { createPageClient, createPublicPageClientWithAuth } from '@/lib/api/server-client';
import { materializeLocalizedPageSections } from '@/features/editor/contract/localized-page';
import { resolveFeaturedImageDeliveryUrl } from '@/lib/media/post-featured-image';
import { mapProtoDocumentLayout } from '@/lib/queries/document-layout';
import { mapPublicLocalizationInfo, maybeFetchSourceLocale } from '@/lib/queries/localized-public';
import { getPublicPageResponse } from '@/lib/queries/page-public.server';
import { createLogger } from '@/lib/utils/logger';
import { isValidUuid } from '@/lib/utils/validation';

const logger = createLogger('page-queries');
type PublicPageClient = Awaited<ReturnType<typeof createPublicPageClientWithAuth>>;
type PublicPageResponse = Awaited<ReturnType<PublicPageClient['get']>>;
type PublicPage = NonNullable<PublicPageResponse['page']>;

// Helper to convert public PageStatus enum to string
function publicPageStatusToString(status: PublicPageStatus): 'draft' | 'published' {
  switch (status) {
    case PublicPageStatus.PUBLISHED:
      return 'published';
    case PublicPageStatus.DRAFT:
    default:
      return 'draft';
  }
}

function pageStatusToString(status: PageStatus): 'draft' | 'published' {
  switch (status) {
    case PageStatus.PUBLISHED:
      return 'published';
    case PageStatus.DRAFT:
    default:
      return 'draft';
  }
}

function mapPublicPageResponse(page: PublicPage, blockMedia: PublicPageResponse['blockMedia']) {
  const content = page.document ? materializeLocalizedPageSections(page.document) : null;
  return {
    id: page.id,
    slug: page.slug ?? null,
    title: page.title,
    summary: page.summary ?? null,
    featuredImageUrl: resolveFeaturedImageDeliveryUrl(page.featuredImageDelivery),
    showTitle: page.showTitle,
    content,
    blockMedia,
    documentLayout: mapProtoDocumentLayout(page.documentLayout),
    localizationInfo: mapPublicLocalizationInfo(page.localizationInfo),
    createdAt: page.createdAt ? timestampDate(page.createdAt) : null,
    updatedAt: page.updatedAt ? timestampDate(page.updatedAt) : null,
    publishedAt: page.publishedAt ? timestampDate(page.publishedAt) : null,
  };
}

interface PageListInput {
  filter?: unknown;
  filterBy?: 'AND' | 'OR';
  sort?: { field: string; order?: 'asc' | 'desc' }[];
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'draft' | 'published';
}

export interface PageListItem {
  id: string;
  title: string;
  slug: string | null;
  status: 'draft' | 'published';
  showTitle: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  publishedAt: Date | null;
}

export interface PageListResult {
  data: PageListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listPagesAdmin(input: PageListInput): Promise<PageListResult> {
  try {
    const client = await createPageClient();
    const limit = input.pageSize ?? 20;
    const offset = ((input.page ?? 1) - 1) * limit;
    const filters = [];
    if (input.search) {
      filters.push({ field: 'search', op: FilterOp.ILIKE, value: input.search });
    }
    if (input.status) {
      filters.push({
        field: 'status',
        op: FilterOp.EQ,
        value: input.status === 'published' ? 'PAGE_STATUS_PUBLISHED' : 'PAGE_STATUS_DRAFT',
      });
    }

    const response = await client.listPagesAdmin({
      pagination: { limit, offset },
      filters,
      sorts: input.sort?.map((s) => ({
        field: s.field,
        order: s.order === 'desc' ? SortOrder.DESC : SortOrder.ASC,
      })),
    });

    const total = response.pagination?.total ?? 0;
    return {
      data: (response.pages ?? []).map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug ?? null,
        status: p.status === PageStatus.PUBLISHED ? 'published' : 'draft',
        showTitle: p.showTitle,
        createdAt: p.createdAt ? timestampDate(p.createdAt) : null,
        updatedAt: p.updatedAt ? timestampDate(p.updatedAt) : null,
        publishedAt: p.publishedAt ? timestampDate(p.publishedAt) : null,
      })),
      total,
      page: input.page ?? 1,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('ListPages RPC error', { error: err.message });
    }
    throwQueryError(err);
  }
}

export async function getPage(idOrSlug: string) {
  try {
    const client = await createPageClient();
    const page = isValidUuid(idOrSlug)
      ? await client.getPage({ id: idOrSlug })
      : await client.getPageBySlug({ slug: idOrSlug });

    return {
      id: page.id,
      title: page.title,
      summary: page.summary ?? null,
      slug: page.slug ?? null,
      document: page.document ?? null,
      documentLayout: mapProtoDocumentLayout(page.documentLayout),
      status: pageStatusToString(page.status),
      showTitle: page.showTitle,
      accessPolicy: fromProtoPageAccessPolicy(page.accessPolicy),
      featuredImageUrl: resolveFeaturedImageDeliveryUrl(page.featuredImageDelivery),
      createdAt: page.createdAt ? timestampDate(page.createdAt) : null,
      updatedAt: page.updatedAt ? timestampDate(page.updatedAt) : null,
      publishedAt: page.publishedAt ? timestampDate(page.publishedAt) : null,
      ogImageUrl: page.ogAsset?.url ?? null,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    if (isConnectError(err)) {
      logger.error('GetPage RPC error', { error: err.message });
    }
    throwQueryError(err);
  }
}

export async function getPageAccessView(
  idOrSlug: string,
  options?: { preferSourceLocale?: boolean; requestedLocale?: string | null },
) {
  try {
    const slug = decodeURIComponent(idOrSlug);
    let response = await getPublicPageResponse(slug, options?.requestedLocale, 'authenticated');
    const initialDenial = deniedPageAccessReason(response.accessReason);
    if (initialDenial) {
      return { reason: initialDenial };
    }
    response = await maybeFetchSourceLocale({
      preferSourceLocale: options?.preferSourceLocale,
      initialResponse: response,
      entity: response.page ?? null,
      fetchWithLocale: async (locale) => {
        return getPublicPageResponse(slug, locale, 'authenticated');
      },
    });

    const denial = deniedPageAccessReason(response.accessReason);
    if (denial) {
      return { reason: denial };
    }
    const page = response.page;
    if (!page) {
      return null;
    }

    return { reason: 'allowed' as const, page: mapPublicPageResponse(page, response.blockMedia) };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    logger.error('GetPageView failed', { error: err });
    throw err;
  }
}

export async function getPageAccessViewWithToken(
  idOrSlug: string,
  token: string,
  requestedLocale?: string | null,
  sharePassword?: string,
) {
  try {
    const client = await createPublicPageClientWithAuth(requestedLocale);
    const response = await client.get({
      slug: decodeURIComponent(idOrSlug),
      shareToken: token,
      sharePassword: sharePassword?.trim() || undefined,
    });

    const denial = deniedPageAccessReason(response.accessReason);
    if (denial) {
      return { reason: denial };
    }
    const page = response.page;
    if (!page) {
      return null;
    }

    return {
      reason: 'allowed' as const,
      page: {
        ...mapPublicPageResponse(page, response.blockMedia),
        status: publicPageStatusToString(page.status),
      },
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    logger.error('GetPageViewWithToken RPC error', { error: err });
    throw err;
  }
}

export type PageDeniedReason = 'authentication-required' | 'conditions-not-met';

function deniedPageAccessReason(reason: PageAccessReason): PageDeniedReason | null {
  switch (reason) {
    case PageAccessReason.AUTHENTICATION_REQUIRED:
      return 'authentication-required';
    case PageAccessReason.CONDITIONS_NOT_MET:
      return 'conditions-not-met';
    case PageAccessReason.ALLOWED:
    case PageAccessReason.UNSPECIFIED:
    case undefined:
      return null;
    default:
      throw new Error('Page service returned an unsupported access decision');
  }
}

export async function getPageView(
  idOrSlug: string,
  options?: { preferSourceLocale?: boolean; requestedLocale?: string | null },
) {
  const access = await getPageAccessView(idOrSlug, options);
  return access?.reason === 'allowed' ? access.page : null;
}

export async function getPageViewWithToken(
  idOrSlug: string,
  token: string,
  requestedLocale?: string | null,
  sharePassword?: string,
) {
  const access = await getPageAccessViewWithToken(idOrSlug, token, requestedLocale, sharePassword);
  return access?.reason === 'allowed' ? access.page : null;
}
