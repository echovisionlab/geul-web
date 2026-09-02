import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import { UserInlineLinksView, type UserInlineLinksViewProps } from './ui/UserInlineLinks/UserInlineLinksView';

export interface UserInlineLinkUser {
  id: string;
  name: string | null;
  image?: string | null;
}

export interface UserInlineLinksProps extends Omit<UserInlineLinksViewProps, 'users'> {
  users: UserInlineLinkUser[];
  unknownLabel: string;
}

export function UserInlineLinks({ users, unknownLabel, ...viewProps }: UserInlineLinksProps) {
  return (
    <UserInlineLinksView
      {...viewProps}
      users={users.map((user) => ({
        id: user.id,
        href: `/user/${user.id}`,
        label: user.name || unknownLabel,
        avatarSrc: buildManagedImageUrl(user.image ?? null, MANAGED_IMAGE_PRESET.AVATAR_XS) ?? null,
        avatarFallback: user.name?.charAt(0) ?? null,
      }))}
    />
  );
}
