import { MemberCriteriaKind } from '@echovisionlab/geul-proto/secure/member_criteria_pb.ts';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { AuthorizationRole } from '@echovisionlab/geul-proto/policy/access_pb.ts';
import { describe, expect, it } from 'vitest';
import {
  buildCriteriaConfig,
  createEmptyConfig,
  rebasePendingConfig,
  SEGMENT_ROLE_OPTIONS,
} from './MemberCriteriaConfig';

describe('criteria criteria config helpers', () => {
  it('turns every offered role option into exactly one criteria role', () => {
    const roles = SEGMENT_ROLE_OPTIONS.map(({ value }) => {
      const { accountRoles } = buildCriteriaConfig(MemberCriteriaKind.FILTER, {
        ...createEmptyConfig(),
        accountRoles: [value],
      });
      expect(accountRoles, value).toHaveLength(1);
      return accountRoles[0];
    });

    expect(roles).toEqual([AuthorizationRole.ADMIN, AuthorizationRole.AUTHOR, AuthorizationRole.USER]);
  });

  it('keeps each user-only Criteria configuration scoped to its criteria type', () => {
    const config = {
      ...createEmptyConfig(),
      memberTagIds: ['user-tag'],
      accountRoles: ['admin'],
    };

    expect(buildCriteriaConfig(MemberCriteriaKind.MEMBER_TAGS, config).memberTagIds).toEqual(['user-tag']);
    expect(buildCriteriaConfig(MemberCriteriaKind.FILTER, config).memberTagIds).toEqual([]);
    expect(buildCriteriaConfig(MemberCriteriaKind.ALL_MEMBERS, config).memberTagIds).toEqual([]);
  });

  it('keeps role filters scoped to users-by-filter criteriaList', () => {
    const config = {
      ...createEmptyConfig(),
      accountRoles: ['author'],
    };

    expect(buildCriteriaConfig(MemberCriteriaKind.FILTER, config).accountRoles).toEqual([AuthorizationRole.AUTHOR]);
    expect(buildCriteriaConfig(MemberCriteriaKind.MEMBER_TAGS, config).accountRoles).toEqual([]);
  });

  it('converts user-filter date strings to typed timestamps', () => {
    const config = {
      ...createEmptyConfig(),
      createdAfter: '2026-01-02T00:00:00.000Z',
      createdBefore: '2026-02-03T00:00:00.000Z',
    };
    const result = buildCriteriaConfig(MemberCriteriaKind.FILTER, config);

    expect(result.createdAfter && timestampDate(result.createdAfter).toISOString()).toBe(config.createdAfter);
    expect(result.createdBefore && timestampDate(result.createdBefore).toISOString()).toBe(config.createdBefore);
    expect(buildCriteriaConfig(MemberCriteriaKind.MEMBER_TAGS, config).createdAfter).toBeUndefined();
  });

  describe('rebasing edits made while a save was pending', () => {
    const submitted = {
      memberTagIds: ['tag-a'],
      accountRoles: ['user', 'author'],
      createdAfter: '2026-01-01',
      createdBefore: '',
    };
    const canonical = {
      memberTagIds: ['tag-a', 'tag-server'],
      accountRoles: ['user', 'author'],
      createdAfter: '2026-01-01T00:00:00.000Z',
      createdBefore: '',
    };

    it('adopts the saved config when nothing changed during the save', () => {
      expect(rebasePendingConfig(canonical, submitted, submitted)).toEqual(canonical);
    });

    it('keeps selections added and removed during the save on top of the saved sets', () => {
      const latest = { ...submitted, memberTagIds: ['tag-a', 'tag-b'], accountRoles: ['user'] };
      const rebased = rebasePendingConfig(canonical, submitted, latest);

      expect([...rebased.memberTagIds].sort()).toEqual(['tag-a', 'tag-b', 'tag-server']);
      expect(rebased.accountRoles).toEqual(['user']);
    });

    it('keeps a date typed during the save and adopts the saved value of an untouched date', () => {
      const latest = { ...submitted, createdBefore: '2026-03-01' };

      expect(rebasePendingConfig(canonical, submitted, latest)).toMatchObject({
        createdAfter: '2026-01-01T00:00:00.000Z',
        createdBefore: '2026-03-01',
      });
    });
  });
});
