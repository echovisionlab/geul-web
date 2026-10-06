import { create } from '@bufbuild/protobuf';
import {
  PageAccessMatch,
  PageAccessMode,
  PageAccessPolicySchema,
  type PageAccessPolicy,
} from '@echovisionlab/geul-proto/common/page_access_pb.ts';
import { AuthorizationRole } from '@echovisionlab/geul-proto/policy/access_pb.ts';

export interface PageAccessPolicyValue {
  mode: 'public' | 'authenticated' | 'conditions';
  match: 'any' | 'all';
  roles: ('author' | 'admin')[];
  userTagIds: string[];
  newsletterSubscriber: boolean;
}

export const DEFAULT_PAGE_ACCESS_POLICY: PageAccessPolicyValue = {
  mode: 'public',
  match: 'any',
  roles: [],
  userTagIds: [],
  newsletterSubscriber: false,
};

const roleNumbers = { author: AuthorizationRole.AUTHOR, admin: AuthorizationRole.ADMIN };

export function fromProtoPageAccessPolicy(policy?: PageAccessPolicy): PageAccessPolicyValue {
  const mode = policy?.mode ?? PageAccessMode.UNSPECIFIED;
  if (mode === PageAccessMode.UNSPECIFIED || mode === PageAccessMode.PUBLIC) {
    return { ...DEFAULT_PAGE_ACCESS_POLICY, roles: [], userTagIds: [] };
  }
  if (mode === PageAccessMode.AUTHENTICATED) {
    return { ...DEFAULT_PAGE_ACCESS_POLICY, mode: 'authenticated', roles: [], userTagIds: [] };
  }
  if (mode !== PageAccessMode.CONDITIONS) {
    throw new Error('Unsupported Page access mode');
  }
  return {
    mode: 'conditions',
    match: policy?.match === PageAccessMatch.ALL ? 'all' : 'any',
    roles: Object.entries(roleNumbers)
      .filter(([, role]) => policy?.allowedRoles.includes(role))
      .map(([role]) => role as PageAccessPolicyValue['roles'][number]),
    userTagIds: [...(policy?.userTagIds ?? [])],
    newsletterSubscriber: policy?.newsletterSubscriber ?? false,
  };
}

export function toProtoPageAccessPolicy(value: PageAccessPolicyValue): PageAccessPolicy {
  return create(PageAccessPolicySchema, {
    mode:
      value.mode === 'public'
        ? PageAccessMode.PUBLIC
        : value.mode === 'authenticated'
          ? PageAccessMode.AUTHENTICATED
          : PageAccessMode.CONDITIONS,
    match: value.mode === 'conditions' && value.match === 'all' ? PageAccessMatch.ALL : PageAccessMatch.ANY,
    allowedRoles: value.mode === 'conditions' ? value.roles.map((role) => roleNumbers[role]) : [],
    userTagIds: value.mode === 'conditions' ? value.userTagIds : [],
    newsletterSubscriber: value.mode === 'conditions' && value.newsletterSubscriber,
  });
}
