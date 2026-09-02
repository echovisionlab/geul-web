import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FilterOp } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { createPageClient } from '@/lib/api/server-client';
import { listPagesAdmin } from './page';

const listPagesAdminMock = vi.fn();

vi.mock('@/lib/api/server-client', () => ({
  createPageClient: vi.fn(),
  createPublicPageClientWithAuth: vi.fn(),
}));

describe('listPagesAdmin', () => {
  beforeEach(() => {
    listPagesAdminMock.mockReset();
    vi.mocked(createPageClient).mockResolvedValue({ listPagesAdmin: listPagesAdminMock } as never);
  });

  it('sends the persisted Page status value for Site Settings target queries', async () => {
    listPagesAdminMock.mockResolvedValue({ pages: [], pagination: { total: 0 } });

    await listPagesAdmin({ page: 1, pageSize: 100, status: 'published' });

    expect(listPagesAdminMock).toHaveBeenCalledWith({
      pagination: { limit: 100, offset: 0 },
      filters: [{ field: 'status', op: FilterOp.EQ, value: 'PAGE_STATUS_PUBLISHED' }],
      sorts: undefined,
    });
  });
});
