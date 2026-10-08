'use server';

import { Code, ConnectError } from '@connectrpc/connect';
import { queryResult, type QueryResult } from '@/lib/api/query-result';
import { createContext } from '@/lib/context';
import { listPagesAdmin, type PageListItem, type PageListResult } from '@/lib/queries/page';

interface PageListInput {
  filter?: unknown;
  filterBy?: 'AND' | 'OR';
  sort?: { field: string; order?: 'asc' | 'desc' }[];
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'draft' | 'published';
}

export async function listAllPagesAdminAction(input: PageListInput): Promise<PageListResult> {
  const ctx = await createContext();
  if (!ctx.member || ctx.member.role !== 'admin') {
    throw new ConnectError('Administrator access required', ctx.member ? Code.PermissionDenied : Code.Unauthenticated);
  }

  return listPagesAdmin(input);
}

const SITE_SETTINGS_PAGE_SIZE = 100;

export async function listAllPublishedPagesAdminAction(): Promise<QueryResult<PageListItem[]>> {
  return queryResult(async () => {
    const ctx = await createContext();
    if (!ctx.member || ctx.member.role !== 'admin') {
      throw new ConnectError(
        'Administrator access required',
        ctx.member ? Code.PermissionDenied : Code.Unauthenticated,
      );
    }

    const pages: PageListItem[] = [];
    let page = 1;

    while (true) {
      const result = await listPagesAdmin({
        page,
        pageSize: SITE_SETTINGS_PAGE_SIZE,
        sort: [{ field: 'title', order: 'asc' }],
        status: 'published',
      });
      pages.push(...result.data);

      if (pages.length >= result.total || result.data.length === 0) {
        return pages;
      }
      page += 1;
    }
  });
}
