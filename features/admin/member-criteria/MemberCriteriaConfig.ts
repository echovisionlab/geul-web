import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { MemberCriteriaConfigSchema, MemberCriteriaKind } from '@echovisionlab/geul-proto/secure/member_criteria_pb.ts';
import { AuthorizationRole } from '@echovisionlab/geul-proto/policy/access_pb.ts';

export const SEGMENT_ROLE_OPTIONS = [{ value: 'admin' }, { value: 'author' }, { value: 'user' }] as const;

export interface CriteriaConfigState {
  memberTagIds: string[];
  accountRoles: string[];
  createdAfter: string;
  createdBefore: string;
}

export function createEmptyConfig(): CriteriaConfigState {
  return {
    memberTagIds: [],
    accountRoles: [],
    createdAfter: '',
    createdBefore: '',
  };
}

function mergePendingStringSet(canonical: string[], submitted: string[], latest: string[]): string[] {
  const merged = new Set(canonical);
  const submittedSet = new Set(submitted);
  const latestSet = new Set(latest);
  for (const value of latest) {
    if (!submittedSet.has(value)) {
      merged.add(value);
    }
  }
  for (const value of submitted) {
    if (!latestSet.has(value)) {
      merged.delete(value);
    }
  }
  return Array.from(merged);
}

/** Applies the edits made while a save was pending (`submitted` -> `latest`) on top of the saved `canonical` config. */
export function rebasePendingConfig(
  canonical: CriteriaConfigState,
  submitted: CriteriaConfigState,
  latest: CriteriaConfigState,
): CriteriaConfigState {
  return {
    memberTagIds: mergePendingStringSet(canonical.memberTagIds, submitted.memberTagIds, latest.memberTagIds),
    accountRoles: mergePendingStringSet(canonical.accountRoles, submitted.accountRoles, latest.accountRoles),
    createdAfter: latest.createdAfter === submitted.createdAfter ? canonical.createdAfter : latest.createdAfter,
    createdBefore: latest.createdBefore === submitted.createdBefore ? canonical.createdBefore : latest.createdBefore,
  };
}

function roleFromValue(role: string): AuthorizationRole | null {
  switch (role) {
    case 'admin':
      return AuthorizationRole.ADMIN;
    case 'author':
      return AuthorizationRole.AUTHOR;
    case 'user':
      return AuthorizationRole.USER;
    default:
      return null;
  }
}

function timestampFromValue(value: string) {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : timestampFromDate(date);
}

export function buildCriteriaConfig(type: MemberCriteriaKind, config: CriteriaConfigState) {
  return create(MemberCriteriaConfigSchema, {
    memberTagIds: type === MemberCriteriaKind.MEMBER_TAGS ? config.memberTagIds : [],
    accountRoles:
      type === MemberCriteriaKind.FILTER
        ? config.accountRoles.flatMap((role) => {
            const mapped = roleFromValue(role);
            return mapped === null ? [] : [mapped];
          })
        : [],
    createdAfter: type === MemberCriteriaKind.FILTER ? timestampFromValue(config.createdAfter) : undefined,
    createdBefore:
      type === MemberCriteriaKind.FILTER && config.createdBefore ? timestampFromValue(config.createdBefore) : undefined,
  });
}
