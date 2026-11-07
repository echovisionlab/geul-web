'use client';
import { useCallback, useMemo } from 'react';
import { Avatar } from '@/components/core/Display';
import { usePathname, useRouter } from 'next/navigation';
import { MySection } from '@echovisionlab/geul-proto/secure/member_pb.ts';
import {
  IconBriefcase,
  IconBuildingStore,
  IconFileText,
  IconForms,
  IconList,
  IconMicrophone,
  IconSettings,
  IconShield,
  IconUser,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { UserAvatarUploader } from '@/features/user/UserAvatarUploader';
import { UserShellView, type UserShellViewTab } from '@/features/user/ui/UserShell';
import { useSession } from '@/lib/auth/client';
import { normalizeMySections } from './sections';
type SectionTabLabelKey =
  'profile' | 'security' | 'settings' | 'posts' | 'series' | 'works' | 'artists' | 'labels' | 'forms';
const SECTION_TABS: Record<
  MySection,
  {
    value: string;
    labelKey: SectionTabLabelKey;
    icon: typeof IconUser;
  }
> = {
  [MySection.UNSPECIFIED]: { value: 'profile', labelKey: 'profile', icon: IconUser },
  [MySection.PROFILE]: { value: 'profile', labelKey: 'profile', icon: IconUser },
  [MySection.SECURITY]: { value: 'security', labelKey: 'security', icon: IconShield },
  [MySection.SETTINGS]: { value: 'settings', labelKey: 'settings', icon: IconSettings },
  [MySection.POSTS]: { value: 'posts', labelKey: 'posts', icon: IconFileText },
  [MySection.SERIES]: { value: 'series', labelKey: 'series', icon: IconList },
  [MySection.WORKS]: { value: 'works', labelKey: 'works', icon: IconBriefcase },
  [MySection.ARTISTS]: { value: 'artists', labelKey: 'artists', icon: IconMicrophone },
  [MySection.LABELS]: { value: 'labels', labelKey: 'labels', icon: IconBuildingStore },
  [MySection.FORMS]: { value: 'forms', labelKey: 'forms', icon: IconForms },
};
interface UserShellProps {
  children: React.ReactNode;
  sections: MySection[];
  user: {
    id: string;
    nickname: string;
    image?: string | null;
    role?: string | null;
  };
}
export function UserShell({ children, sections, user }: UserShellProps) {
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const displayUser = session?.user ?? user;
  const tabs = useMemo<UserShellViewTab[]>(() => {
    return normalizeMySections(sections)
      .map((section) => SECTION_TABS[section])
      .filter((tab, index, arr) => arr.findIndex((candidate) => candidate.value === tab.value) === index)
      .map((tab) => ({
        value: tab.value,
        icon: tab.icon,
        label:
          tab.labelKey === 'works'
            ? tCommonEntities('works')
            : tab.labelKey === 'posts'
              ? tCommonEntities('posts')
              : tab.labelKey === 'series'
                ? tCommonEntities('series')
                : tab.labelKey === 'profile'
                  ? tCommon('labels.profile')
                  : tab.labelKey === 'security'
                    ? tCommon('labels.security')
                    : tab.labelKey === 'artists'
                      ? tCommonEntities('artists')
                      : tab.labelKey === 'forms'
                        ? tCommonEntities('forms')
                        : tCommon('labels.settings'),
      }));
  }, [displayUser.role, sections, tCommon, tCommonEntities]);
  const pathnameSegments = pathname.split('/').filter(Boolean);
  const currentTabCandidate = pathnameSegments[0] === 'my' ? (pathnameSegments[1] ?? 'profile') : 'profile';
  const currentTab = tabs.some((tab) => tab.value === currentTabCandidate) ? currentTabCandidate : 'profile';
  const handleTabChange = useCallback(
    (value: string | null) => {
      if (value) {
        router.push(`/my/${value}`);
      }
    },
    [router],
  );
  const events = useMemo(() => ({ onTabChange: handleTabChange }), [handleTabChange]);
  const roleLabel =
    displayUser.role === 'admin'
      ? tCommon('roles.admin')
      : displayUser.role === 'author'
        ? tCommon('roles.author')
        : displayUser.role === 'user' || !displayUser.role
          ? tCommon('roles.user')
          : displayUser.role;
  const avatarSlot =
    currentTab === 'profile' ? (
      <UserAvatarUploader
        memberId={displayUser.id}
        currentImage={displayUser.image}
        userName={displayUser.nickname}
        size={80}
        isOwnProfile
      />
    ) : (
      <Avatar
        src={displayUser.image}
        alt={displayUser.nickname}
        size="profile"
        shape="circle"
        name={displayUser.nickname}
      />
    );
  return (
    <UserShellView
      user={{
        name: displayUser.nickname,
        roleLabel,
        roleTone: displayUser.role === 'admin' ? 'accent' : 'neutral',
        navigationLabel: `${tCommon('labels.account')} ${tCommon('labels.menu')}`,
      }}
      tabs={tabs}
      currentTab={currentTab}
      events={events}
      avatarSlot={avatarSlot}
    >
      {children}
    </UserShellView>
  );
}
