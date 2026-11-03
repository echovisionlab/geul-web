import { revalidatePath } from 'next/cache';
import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
import { create } from '@bufbuild/protobuf';
import { AuthorizationRole } from '@echovisionlab/geul-proto/policy/access_pb.ts';
import {
  MemberCriteriaConfigSchema,
  MemberCriteriaConfigSnapshotSchema,
  MemberCriteriaKind,
} from '@echovisionlab/geul-proto/secure/member_criteria_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemberCriteriaClient } from '@/lib/api/server-client';
import { updateMemberCriteriaAction } from './member-criteria';

const updateMemberCriteria = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/api/server-client', () => ({ createMemberCriteriaClient: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createMemberCriteriaClient).mockResolvedValue({ updateMemberCriteria } as never);
});

describe('updateMemberCriteriaAction', () => {
  it('sends the observed config snapshot and returns the canonical saved criteria', async () => {
    const observedConfig = create(MemberCriteriaConfigSchema, {
      accountRoles: [AuthorizationRole.USER],
      createdAfter: timestampFromDate(new Date('2026-01-01T00:00:00.000Z')),
    });
    const desiredConfig = create(MemberCriteriaConfigSchema, {
      accountRoles: [AuthorizationRole.ADMIN, AuthorizationRole.USER],
      createdAfter: timestampFromDate(new Date('2026-01-01T00:00:00.000Z')),
    });
    const createdBefore = timestampFromDate(new Date('2026-04-01T00:00:00.000Z'));
    const archivedAt = timestampFromDate(new Date('2026-05-01T00:00:00.000Z'));
    updateMemberCriteria.mockResolvedValue({
      id: 'criteria-a',
      name: 'Canonical name',
      description: '',
      kind: MemberCriteriaKind.FILTER,
      config: create(MemberCriteriaConfigSchema, {
        accountRoles: [AuthorizationRole.ADMIN],
        createdBefore,
        excludeMemberIds: ['member-a'],
      }),
      matchingMemberCount: 42,
      archivedAt,
    });

    const result = await updateMemberCriteriaAction({
      id: 'criteria-a',
      name: 'Local name',
      config: desiredConfig,
      observed: { kind: MemberCriteriaKind.FILTER, config: observedConfig },
    });

    expect(updateMemberCriteria).toHaveBeenCalledWith({
      id: 'criteria-a',
      name: 'Local name',
      description: undefined,
      kind: undefined,
      config: desiredConfig,
      observed: create(MemberCriteriaConfigSnapshotSchema, {
        kind: MemberCriteriaKind.FILTER,
        config: observedConfig,
      }),
    });
    expect(result.data).toEqual({
      id: 'criteria-a',
      name: 'Canonical name',
      description: '',
      kind: MemberCriteriaKind.FILTER,
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
    expect(revalidatePath).toHaveBeenCalledWith('/admin/member-criteria');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/campaigns');
  });
});
