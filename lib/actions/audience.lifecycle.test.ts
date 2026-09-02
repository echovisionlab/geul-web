import { revalidatePath } from 'next/cache';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { SegmentType } from '@echovisionlab/geul-proto/secure/audience_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudienceClient } from '@/lib/api/server-client';
import {
  archiveSegmentAction,
  listActiveSegmentsAction,
  listSegmentsAdminAction,
  restoreSegmentAction,
} from './audience';

const listSegmentsAdmin = vi.fn();
const archiveSegment = vi.fn();
const restoreSegment = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createAudienceClient: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createAudienceClient).mockResolvedValue({
    listSegmentsAdmin,
    archiveSegment,
    restoreSegment,
  } as never);
});

describe('Audience lifecycle actions', () => {
  it('maps typed dependency counts and archive state from the admin contract', async () => {
    const archivedAt = new Date('2026-07-30T00:00:00.000Z');
    listSegmentsAdmin.mockResolvedValue({
      segments: [
        {
          id: 'audience-1',
          name: 'Members',
          description: '',
          segmentType: SegmentType.MEMBERS_BY_FILTER,
          campaignCount: 2,
          deliveryRunCount: 3,
          downloadPolicyReferenceCount: 4,
          archivedAt: timestampFromDate(archivedAt),
        },
      ],
      pagination: { total: 1 },
    });

    const result = await listSegmentsAdminAction({ includeArchived: true });

    expect(listSegmentsAdmin).toHaveBeenCalledWith(expect.objectContaining({ includeArchived: true }));
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        campaign_count: 2,
        delivery_run_count: 3,
        download_policy_reference_count: 4,
        archived_at: archivedAt,
      }),
    );
  });

  it('hard-codes active-only Audience data for composition pickers', async () => {
    listSegmentsAdmin.mockResolvedValue({ segments: [], pagination: { total: 0 } });

    await expect(listActiveSegmentsAction()).resolves.toEqual([]);

    expect(listSegmentsAdmin).toHaveBeenCalledWith(expect.objectContaining({ includeArchived: false }));
  });

  it('loads every active Audience page instead of truncating composition options at 100', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `audience-${index + 1}`,
      name: `Audience ${index + 1}`,
      segmentType: SegmentType.MEMBERS_BY_FILTER,
    }));
    listSegmentsAdmin
      .mockResolvedValueOnce({
        segments: firstPage,
        pagination: { total: 101, limit: 100, offset: 0, hasMore: true },
      })
      .mockResolvedValueOnce({
        segments: [
          {
            id: 'audience-101',
            name: 'Audience 101',
            segmentType: SegmentType.MEMBER_TAGS,
          },
        ],
        pagination: { total: 101, limit: 100, offset: 100, hasMore: false },
      });

    const result = await listActiveSegmentsAction();

    expect(result).toHaveLength(101);
    expect(result[100]).toEqual({
      id: 'audience-101',
      name: 'Audience 101',
      segmentTypeLabel: 'User Tags',
    });
    expect(listSegmentsAdmin).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        pagination: expect.objectContaining({ limit: 100, offset: 0 }),
        includeArchived: false,
      }),
    );
    expect(listSegmentsAdmin).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        pagination: expect.objectContaining({ limit: 100, offset: 100 }),
        includeArchived: false,
      }),
    );
  });

  it('surfaces an active Audience query failure instead of presenting an empty valid set', async () => {
    listSegmentsAdmin.mockRejectedValueOnce(new Error('backend unavailable'));

    await expect(listActiveSegmentsAction()).rejects.toThrow('Unable to load active Audience options');
  });

  it('archives and restores without a delete compatibility path', async () => {
    archiveSegment.mockResolvedValue({});
    restoreSegment.mockResolvedValue({});

    await expect(archiveSegmentAction('audience-1')).resolves.toEqual({ success: true });
    await expect(restoreSegmentAction('audience-1')).resolves.toEqual({ success: true });

    expect(archiveSegment).toHaveBeenCalledWith({ id: 'audience-1' });
    expect(restoreSegment).toHaveBeenCalledWith({ id: 'audience-1' });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/audience-segments');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/campaigns');
  });

  it('preserves a committed archive when cache invalidation fails', async () => {
    archiveSegment.mockResolvedValue({});
    vi.mocked(revalidatePath).mockImplementation(() => {
      throw new Error('cache unavailable');
    });

    await expect(archiveSegmentAction('audience-1')).resolves.toEqual({ success: true });
  });
});
