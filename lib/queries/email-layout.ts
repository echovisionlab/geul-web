import { isConnectErrorCode } from '@/lib/api/connect-error';
import { timestampDate, type Timestamp } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { FilterOp, type SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { createEmailLayoutClient } from '@/lib/api/browser-client';
import { createClientLogger, serializeClientLogError } from '@/lib/utils/client-logger';

const logger = createClientLogger('email-layout-queries');

export interface EmailLayout {
  id: string;
  name: string;
  key: string;
  htmlContent: string;
  campaignCount: number;
  templateCount: number;
  deliveryRunCount: number;
  createdAt: Date;
  updatedAt?: Date;
}

export interface EmailLayoutBasic {
  id: string;
  name: string;
  key: string;
}

function mapLayout(l: {
  id: string;
  name: string;
  key: string;
  htmlContent: string;
  campaignCount: number;
  templateCount: number;
  deliveryRunCount: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}): EmailLayout {
  return {
    id: l.id,
    name: l.name,
    key: l.key,
    htmlContent: l.htmlContent,
    campaignCount: l.campaignCount,
    templateCount: l.templateCount,
    deliveryRunCount: l.deliveryRunCount,
    createdAt: l.createdAt ? timestampDate(l.createdAt) : new Date(),
    updatedAt: l.updatedAt ? timestampDate(l.updatedAt) : undefined,
  };
}

function mapLayoutBasic(l: { id: string; name: string; key: string }): EmailLayoutBasic {
  return {
    id: l.id,
    name: l.name,
    key: l.key,
  };
}

interface ListEmailLayoutsInput {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: { field: string; order?: 'asc' | 'desc' }[];
}

export async function listEmailLayouts(input: ListEmailLayoutsInput = {}) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;

  try {
    const client = createEmailLayoutClient();

    const sorts = input.sort?.map((s) => ({
      field: s.field,
      order: (s.order === 'desc' ? 2 : 1) as SortOrder,
    }));

    const response = await client.listEmailLayoutsAdmin({
      pagination: { limit: pageSize, offset: (page - 1) * pageSize },
      filters: input.search ? [{ field: 'search', op: FilterOp.ILIKE, value: input.search }] : undefined,
      sorts,
    });

    const total = response.pagination?.total ?? 0;

    return {
      data: (response.layouts ?? []).map(mapLayout),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (err) {
    logger.error('Failed to list email layouts', { error: serializeClientLogError(err) });
    throw err;
  }
}

export async function listEmailLayoutsSimple(): Promise<EmailLayoutBasic[]> {
  try {
    const client = createEmailLayoutClient();
    const pageSize = 100;
    const layouts: EmailLayoutBasic[] = [];
    let offset = 0;

    while (true) {
      const response = await client.listEmailLayoutsAdmin({
        pagination: { limit: pageSize, offset },
      });
      const page = (response.layouts ?? []).map(mapLayoutBasic);
      layouts.push(...page);
      const total = response.pagination?.total ?? layouts.length;
      if (page.length === 0 || layouts.length >= total) {
        return layouts;
      }
      offset += page.length;
    }
  } catch (err) {
    logger.error('Failed to list email layouts', { error: serializeClientLogError(err) });
    throw err;
  }
}

export async function getEmailLayout(id: string): Promise<EmailLayout | null> {
  try {
    const client = createEmailLayoutClient();
    const response = await client.getEmailLayout({ id });
    return mapLayout(response);
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return null;
    }
    throw err;
  }
}

export async function previewEmailLayout(
  id: string,
  sampleContent?: string,
  locale?: string,
): Promise<{ html: string } | null> {
  try {
    const client = createEmailLayoutClient();
    const response = await client.previewEmailLayout({
      id,
      sampleContent,
      locale,
    });
    return { html: response.html };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return null;
    }
    throw err;
  }
}
