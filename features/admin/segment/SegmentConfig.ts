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
