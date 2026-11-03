import { unwrapQueryResult } from '@/lib/api/query-result';
import { revalidatePath } from 'next/cache';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { MemberCriteriaKind } from '@echovisionlab/geul-proto/secure/member_criteria_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemberCriteriaClient } from '@/lib/api/server-client';
import {
  archiveMemberCriteriaAction,
  listActiveMemberCriteriaAction,
  listMemberCriteriaAdminAction,
  restoreMemberCriteriaAction,
} from './member-criteria';

const listMemberCriteriaAdmin = vi.fn();
const archiveMemberCriteria = vi.fn();
const restoreMemberCriteria = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createMemberCriteriaClient: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createMemberCriteriaClient).mockResolvedValue({
    listMemberCriteriaAdmin,
    archiveMemberCriteria,
    restoreMemberCriteria,
  } as never);
});

describe('Criteria lifecycle actions', () => {
  it('maps typed dependency counts and archive state from the admin contract', async () => {
    const archivedAt = new Date('2026-07-30T00:00:00.000Z');
    listMemberCriteriaAdmin.mockResolvedValue({
      memberCriteria: [
        {
          id: 'criteria-1',
          name: 'Members',
          description: '',
          kind: MemberCriteriaKind.FILTER,
          campaignCount: 2,
          deliveryRunCount: 3,
          downloadPolicyReferenceCount: 4,
          archivedAt: timestampFromDate(archivedAt),
        },
      ],
      pagination: { total: 1 },
    });

    const result = await listMemberCriteriaAdminAction({ includeArchived: true }).then(unwrapQueryResult);

    expect(listMemberCriteriaAdmin).toHaveBeenCalledWith(expect.objectContaining({ includeArchived: true }));
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        campaign_count: 2,
        delivery_run_count: 3,
        download_policy_reference_count: 4,
        archived_at: archivedAt,
      }),
    );
  });

  it('loads every active Criteria page instead of truncating composition options at 100', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `criteria-${index + 1}`,
      name: `Criteria ${index + 1}`,
      kind: MemberCriteriaKind.FILTER,
    }));
    listMemberCriteriaAdmin
      .mockResolvedValueOnce({
        memberCriteria: firstPage,
        pagination: { total: 101, limit: 100, offset: 0, hasMore: true },
      })
      .mockResolvedValueOnce({
        memberCriteria: [
          {
            id: 'criteria-101',
            name: 'Criteria 101',
            kind: MemberCriteriaKind.MEMBER_TAGS,
          },
        ],
        pagination: { total: 101, limit: 100, offset: 100, hasMore: false },
      });

    const result = await listActiveMemberCriteriaAction();

    expect(result).toHaveLength(101);
    expect(result[100]).toEqual({
      id: 'criteria-101',
      name: 'Criteria 101',
      kindLabel: 'User Tags',
    });
    expect(listMemberCriteriaAdmin).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        pagination: expect.objectContaining({ limit: 100, offset: 0 }),
        includeArchived: false,
      }),
    );
    expect(listMemberCriteriaAdmin).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        pagination: expect.objectContaining({ limit: 100, offset: 100 }),
        includeArchived: false,
      }),
    );
  });

  it('surfaces an active Criteria query failure instead of presenting an empty valid set', async () => {
    listMemberCriteriaAdmin.mockRejectedValueOnce(new Error('backend unavailable'));

    await expect(listActiveMemberCriteriaAction()).rejects.toThrow('Unable to load active Member criteria options');
  });

  it('archives and restores without a delete compatibility path', async () => {
    archiveMemberCriteria.mockResolvedValue({});
    restoreMemberCriteria.mockResolvedValue({});

    await expect(archiveMemberCriteriaAction('criteria-1')).resolves.toEqual({ ok: true, success: true });
    await expect(restoreMemberCriteriaAction('criteria-1')).resolves.toEqual({ ok: true, success: true });

    expect(archiveMemberCriteria).toHaveBeenCalledWith({ id: 'criteria-1' });
    expect(restoreMemberCriteria).toHaveBeenCalledWith({ id: 'criteria-1' });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/member-criteria');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/campaigns');
  });

  it('preserves a committed archive when cache invalidation fails', async () => {
    archiveMemberCriteria.mockResolvedValue({});
    vi.mocked(revalidatePath).mockImplementation(() => {
      throw new Error('cache unavailable');
    });

    await expect(archiveMemberCriteriaAction('criteria-1')).resolves.toEqual({ ok: true, success: true });
  });
});
