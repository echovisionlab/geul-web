import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { SegmentConfigSchema, SegmentType } from '@echovisionlab/geul-proto/secure/audience_pb.ts';
import { AuthorizationRole } from '@echovisionlab/geul-proto/policy/access_pb.ts';

export const SEGMENT_ROLE_OPTIONS = [{ value: 'admin' }, { value: 'author' }, { value: 'user' }] as const;

export interface SegmentConfigState {
  memberTagIds: string[];
  accountRoles: string[];
  createdAfter: string;
  createdBefore: string;
}

export function createEmptyConfig(): SegmentConfigState {
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
  canonical: SegmentConfigState,
  submitted: SegmentConfigState,
  latest: SegmentConfigState,
): SegmentConfigState {
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

export function buildSegmentConfig(type: SegmentType, config: SegmentConfigState) {
  return create(SegmentConfigSchema, {
    memberTagIds: type === SegmentType.MEMBER_TAGS ? config.memberTagIds : [],
    accountRoles:
      type === SegmentType.MEMBERS_BY_FILTER
        ? config.accountRoles.flatMap((role) => {
            const mapped = roleFromValue(role);
            return mapped === null ? [] : [mapped];
          })
        : [],
    createdAfter: type === SegmentType.MEMBERS_BY_FILTER ? timestampFromValue(config.createdAfter) : undefined,
    createdBefore:
      type === SegmentType.MEMBERS_BY_FILTER && config.createdBefore
        ? timestampFromValue(config.createdBefore)
        : undefined,
  });
}
