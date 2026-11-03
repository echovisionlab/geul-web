'use client';

import { MemberCriteriaKind } from '@echovisionlab/geul-proto/secure/member_criteria_pb.ts';
import { useTranslations } from 'next-intl';

export function useMemberCriteriaKindLabel(): (kind: MemberCriteriaKind) => string {
  const tPage = useTranslations('adminList.memberCriteria');
  const tCommon = useTranslations('common');
  return (kind) => {
    switch (kind) {
      case MemberCriteriaKind.ALL_MEMBERS:
        return tPage('types.allUsers');
      case MemberCriteriaKind.MEMBER_TAGS:
        return tCommon('entities.userTags');
      case MemberCriteriaKind.FILTER:
        return tPage('types.usersByFilter');
      default:
        return tCommon('states.unknown');
    }
  };
}
