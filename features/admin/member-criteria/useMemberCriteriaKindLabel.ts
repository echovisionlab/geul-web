'use client';

import { MemberCriteriaKind } from '@echovisionlab/geul-proto/secure/member_criteria_pb.ts';
import { useTranslations } from 'next-intl';

export function useMemberCriteriaKindLabel(): (kind: MemberCriteriaKind) => string {
  const tTypes = useTranslations('adminList.memberCriteria.types');
  const tCommon = useTranslations('common');
  return (kind) => {
    switch (kind) {
      case MemberCriteriaKind.ALL_MEMBERS:
        return tTypes('allUsers');
      case MemberCriteriaKind.MEMBER_TAGS:
        return tCommon('entities.userTags');
      case MemberCriteriaKind.FILTER:
        return tTypes('usersByFilter');
      default:
        return tCommon('states.unknown');
    }
  };
}
