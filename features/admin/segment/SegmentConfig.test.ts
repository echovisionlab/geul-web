import { SegmentType } from '@echovisionlab/geul-proto/secure/audience_pb.ts';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { AuthorizationRole } from '@echovisionlab/geul-proto/policy/access_pb.ts';
import { describe, expect, it } from 'vitest';
import { buildSegmentConfig, createEmptyConfig, SEGMENT_ROLE_OPTIONS } from './SegmentConfig';

describe('audience segment config helpers', () => {
  it('turns every offered role option into exactly one segment role', () => {
    const roles = SEGMENT_ROLE_OPTIONS.map(({ value }) => {
      const { accountRoles } = buildSegmentConfig(SegmentType.MEMBERS_BY_FILTER, {
        ...createEmptyConfig(),
        accountRoles: [value],
      });
      expect(accountRoles, value).toHaveLength(1);
      return accountRoles[0];
    });

    expect(roles).toEqual([AuthorizationRole.ADMIN, AuthorizationRole.AUTHOR, AuthorizationRole.USER]);
  });

  it('keeps each user-only Audience configuration scoped to its segment type', () => {
    const config = {
      ...createEmptyConfig(),
      memberTagIds: ['user-tag'],
      accountRoles: ['admin'],
    };

    expect(buildSegmentConfig(SegmentType.MEMBER_TAGS, config).memberTagIds).toEqual(['user-tag']);
    expect(buildSegmentConfig(SegmentType.MEMBERS_BY_FILTER, config).memberTagIds).toEqual([]);
    expect(buildSegmentConfig(SegmentType.ALL_MEMBERS, config).memberTagIds).toEqual([]);
  });

  it('keeps role filters scoped to users-by-filter segments', () => {
    const config = {
      ...createEmptyConfig(),
      accountRoles: ['author'],
    };

    expect(buildSegmentConfig(SegmentType.MEMBERS_BY_FILTER, config).accountRoles).toEqual([AuthorizationRole.AUTHOR]);
    expect(buildSegmentConfig(SegmentType.MEMBER_TAGS, config).accountRoles).toEqual([]);
  });

  it('converts user-filter date strings to typed timestamps', () => {
    const config = {
      ...createEmptyConfig(),
      createdAfter: '2026-01-02T00:00:00.000Z',
      createdBefore: '2026-02-03T00:00:00.000Z',
    };
    const result = buildSegmentConfig(SegmentType.MEMBERS_BY_FILTER, config);

    expect(result.createdAfter && timestampDate(result.createdAfter).toISOString()).toBe(config.createdAfter);
    expect(result.createdBefore && timestampDate(result.createdBefore).toISOString()).toBe(config.createdBefore);
    expect(buildSegmentConfig(SegmentType.MEMBER_TAGS, config).createdAfter).toBeUndefined();
  });
});
