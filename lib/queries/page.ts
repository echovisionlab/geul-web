import { isConnectError, isConnectErrorCode } from '@/lib/api/connect-error';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { FilterOp, SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { PageStatus as PublicPageStatus } from '@echovisionlab/geul-proto/public/page_pb.ts';
import { PageStatus } from '@echovisionlab/geul-proto/secure/page_pb.ts';
import { createPageClient, createPublicPageClientWithAuth } from '@/lib/api/server-client';
import { materializeLocalizedPageSections } from '@/features/editor/contract/localized-page';
import { resolveFeaturedImageDeliveryUrl } from '@/lib/media/post-featured-image';
import { mapProtoDocumentLayout } from '@/lib/queries/document-layout';
import { mapPublicLocalizationInfo, maybeFetchSourceLocale } from '@/lib/queries/localized-public';
import { createLogger } from '@/lib/utils/logger';
import { isValidUuid } from '@/lib/utils/validation';

const logger = createLogger('page-queries');

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
    return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
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
      featuredImageUrl: resolveFeaturedImageDeliveryUrl(page.featuredImageDelivery),
      createdAt: page.createdAt ? timestampDate(page.createdAt) : null,
      updatedAt: page.updatedAt ? timestampDate(page.updatedAt) : null,
      publishedAt: page.publishedAt ? timestampDate(page.publishedAt) : null,
      ogImageUrl: page.ogAsset?.url ?? null,
    };
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('GetPage RPC error', { error: err.message });
    }
    return null;
  }
}

export async function getPageView(
  idOrSlug: string,
  options?: { preferSourceLocale?: boolean; requestedLocale?: string | null },
) {
  try {
    const slug = decodeURIComponent(idOrSlug);
    const client = await createPublicPageClientWithAuth(options?.requestedLocale);
    let response = await client.get({ slug });
    response = await maybeFetchSourceLocale({
      preferSourceLocale: options?.preferSourceLocale,
      initialResponse: response,
      entity: response.page ?? null,
      fetchWithLocale: async (locale) => {
        const sourceClient = await createPublicPageClientWithAuth(locale);
        return sourceClient.get({ slug });
      },
    });

    const page = response.page;
    if (!page) {
      return null;
    }

    const content = page.document ? materializeLocalizedPageSections(page.document) : null;

    return {
      id: page.id,
      slug: page.slug ?? null,
      title: page.title,
      summary: page.summary ?? null,
      featuredImageUrl: resolveFeaturedImageDeliveryUrl(page.featuredImageDelivery),
      showTitle: page.showTitle,
      content,
      blockMedia: response.blockMedia,
      documentLayout: mapProtoDocumentLayout(page.documentLayout),
      localizationInfo: mapPublicLocalizationInfo(page.localizationInfo),
      createdAt: page.createdAt ? timestampDate(page.createdAt) : null,
      updatedAt: page.updatedAt ? timestampDate(page.updatedAt) : null,
      publishedAt: page.publishedAt ? timestampDate(page.publishedAt) : null,
    };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.NotFound) {
        return null;
      }
      logger.error('GetPageView RPC error', { error: err.message });
    }
    return null;
  }
}

export async function getPageViewWithToken(
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

    const page = response.page;
    if (!page) {
      return null;
    }

    const content = page.document ? materializeLocalizedPageSections(page.document) : null;

    return {
      id: page.id,
      slug: page.slug ?? null,
      title: page.title,
      summary: page.summary ?? null,
      featuredImageUrl: resolveFeaturedImageDeliveryUrl(page.featuredImageDelivery),
      status: publicPageStatusToString(page.status),
      showTitle: page.showTitle,
      content,
      blockMedia: response.blockMedia,
      documentLayout: mapProtoDocumentLayout(page.documentLayout),
      localizationInfo: mapPublicLocalizationInfo(page.localizationInfo),
      createdAt: page.createdAt ? timestampDate(page.createdAt) : null,
      updatedAt: page.updatedAt ? timestampDate(page.updatedAt) : null,
      publishedAt: page.publishedAt ? timestampDate(page.publishedAt) : null,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    logger.error('GetPageViewWithToken RPC error', { error: err });
    throw err;
  }
}
