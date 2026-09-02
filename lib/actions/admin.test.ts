import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listAllPublishedPagesAdminAction } from './admin';

const { createContextMock, listPagesAdminMock } = vi.hoisted(() => ({
  createContextMock: vi.fn(),
  listPagesAdminMock: vi.fn(),
}));

vi.mock('@/lib/context', () => ({ createContext: createContextMock }));
vi.mock('@/lib/queries/page', () => ({ listPagesAdmin: listPagesAdminMock }));

function page(id: string) {
  return {
    id,
    title: id,
    slug: null,
    status: 'published' as const,
    showTitle: true,
    createdAt: null,
    updatedAt: null,
    publishedAt: null,
  };
}

describe('listAllPublishedPagesAdminAction', () => {
  beforeEach(() => {
    createContextMock.mockReset();
    listPagesAdminMock.mockReset();
  });

  it('returns every published Page across API pages', async () => {
    createContextMock.mockResolvedValue({ member: { role: 'admin' } });
    const firstPage = Array.from({ length: 100 }, (_, index) => page(`page-${index + 1}`));
    listPagesAdminMock
      .mockResolvedValueOnce({ data: firstPage, total: 101, page: 1, pageSize: 100, totalPages: 2 })
      .mockResolvedValueOnce({ data: [page('page-101')], total: 101, page: 2, pageSize: 100, totalPages: 2 });

    const result = await listAllPublishedPagesAdminAction();

    expect(result).toHaveLength(101);
    expect(result.at(-1)?.id).toBe('page-101');
    expect(listPagesAdminMock).toHaveBeenNthCalledWith(1, {
      page: 1,
      pageSize: 100,
      sort: [{ field: 'title', order: 'asc' }],
      status: 'published',
    });
    expect(listPagesAdminMock).toHaveBeenNthCalledWith(2, {
      page: 2,
      pageSize: 100,
      sort: [{ field: 'title', order: 'asc' }],
      status: 'published',
    });
  });

  it('does not list targets for a non-admin Member', async () => {
    createContextMock.mockResolvedValue({ member: { role: 'author' } });

    await expect(listAllPublishedPagesAdminAction()).resolves.toEqual([]);
    expect(listPagesAdminMock).not.toHaveBeenCalled();
  });
});
