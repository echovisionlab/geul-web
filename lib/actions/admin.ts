'use server';

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
    return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }

  return listPagesAdmin(input);
}

const SITE_SETTINGS_PAGE_SIZE = 100;

export async function listAllPublishedPagesAdminAction(): Promise<PageListItem[]> {
  const ctx = await createContext();
  if (!ctx.member || ctx.member.role !== 'admin') {
    return [];
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
}
