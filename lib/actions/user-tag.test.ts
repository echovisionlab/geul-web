import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { FilterOp, SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listUserTagsAdminAction } from './user-tag';

const mocks = vi.hoisted(() => ({
  createMemberClient: vi.fn(),
  listMemberTagsAdmin: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/api/server-client', () => ({ createMemberClient: mocks.createMemberClient }));
vi.mock('@/lib/utils/logger', () => ({ createLogger: () => ({ error: vi.fn() }) }));

describe('admin Member tag actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createMemberClient.mockResolvedValue({ listMemberTagsAdmin: mocks.listMemberTagsAdmin });
    mocks.listMemberTagsAdmin.mockResolvedValue({
      tags: [
        {
          id: 'tag-1',
          name: 'Editorial',
          memberCount: 2,
          createdAt: timestampFromDate(new Date('2026-01-01T00:00:00Z')),
        },
      ],
      pagination: { total: 1 },
    });
  });

  it('forwards allowlisted search, filter, sort, and pagination', async () => {
    await expect(
      listUserTagsAdminAction({
        page: 2,
        pageSize: 10,
        search: 'editor',
        filter: [{ field: 'created_at', op: 'gte', value: '2026-01-01' }],
        sort: [{ field: 'user_count', order: 'desc' }],
      }),
    ).resolves.toMatchObject({ data: [{ id: 'tag-1', user_count: 2 }], total: 1, page: 2, pageSize: 10 });

    expect(mocks.listMemberTagsAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: expect.objectContaining({ limit: 10, offset: 10 }),
        filters: [
          expect.objectContaining({ field: 'search', op: FilterOp.ILIKE, value: 'editor' }),
          expect.objectContaining({ field: 'created_at', op: FilterOp.GTE, value: '2026-01-01' }),
        ],
        sorts: [expect.objectContaining({ field: 'user_count', order: SortOrder.DESC })],
      }),
    );
  });
});
