import { revalidatePath } from 'next/cache';
import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
import { create } from '@bufbuild/protobuf';
import { AuthorizationRole } from '@echovisionlab/geul-proto/policy/access_pb.ts';
import {
  SegmentConfigSchema,
  SegmentConfigSnapshotSchema,
  SegmentType,
} from '@echovisionlab/geul-proto/secure/audience_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudienceClient } from '@/lib/api/server-client';
import { updateSegmentAction } from './audience';

const updateSegment = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/api/server-client', () => ({ createAudienceClient: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createAudienceClient).mockResolvedValue({ updateSegment } as never);
});

describe('updateSegmentAction', () => {
  it('sends the observed config snapshot and returns the canonical saved segment', async () => {
    const observedConfig = create(SegmentConfigSchema, {
      accountRoles: [AuthorizationRole.USER],
      createdAfter: timestampFromDate(new Date('2026-01-01T00:00:00.000Z')),
    });
    const desiredConfig = create(SegmentConfigSchema, {
      accountRoles: [AuthorizationRole.ADMIN, AuthorizationRole.USER],
      createdAfter: timestampFromDate(new Date('2026-01-01T00:00:00.000Z')),
    });
    const createdBefore = timestampFromDate(new Date('2026-04-01T00:00:00.000Z'));
    const archivedAt = timestampFromDate(new Date('2026-05-01T00:00:00.000Z'));
    updateSegment.mockResolvedValue({
      id: 'segment-a',
      name: 'Canonical name',
      description: '',
      segmentType: SegmentType.MEMBERS_BY_FILTER,
      config: create(SegmentConfigSchema, {
        accountRoles: [AuthorizationRole.ADMIN],
        createdBefore,
        excludeMemberIds: ['member-a'],
      }),
      estimatedCount: 42,
      archivedAt,
    });

    const result = await updateSegmentAction({
      id: 'segment-a',
      name: 'Local name',
      config: desiredConfig,
      observed: { segmentType: SegmentType.MEMBERS_BY_FILTER, config: observedConfig },
    });

    expect(updateSegment).toHaveBeenCalledWith({
      id: 'segment-a',
      name: 'Local name',
      description: undefined,
      segmentType: undefined,
      config: desiredConfig,
      observed: create(SegmentConfigSnapshotSchema, {
        segmentType: SegmentType.MEMBERS_BY_FILTER,
        config: observedConfig,
      }),
    });
    expect(result.data).toEqual({
      id: 'segment-a',
      name: 'Canonical name',
      description: '',
      segmentType: SegmentType.MEMBERS_BY_FILTER,
      config: {
        memberTagIds: [],
        accountRoles: ['admin'],
        createdAfter: undefined,
        createdBefore: timestampDate(createdBefore).toISOString(),
        excludeMemberIds: ['member-a'],
      },
      estimatedCount: 42,
      archivedAt: timestampDate(archivedAt),
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/audience-segments');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/campaigns');
  });
});
