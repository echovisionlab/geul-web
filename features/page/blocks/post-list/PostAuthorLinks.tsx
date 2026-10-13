import type { AvatarSize } from '@/components/core/Display';
import { UserInlineLinks, type UserInlineLinkUser } from '@/features/user/UserInlineLinks';

export type PostAuthorLinkAuthor = UserInlineLinkUser;

interface PostAuthorLinksProps {
  authors: PostAuthorLinkAuthor[];
  unknownLabel: string;
  textSize?: 'xs' | 'sm';
  textColor?: import('@/components/core/Typography').TextTone;
  avatarSize?: AvatarSize;
  showAvatars?: boolean;
  maxVisibleAuthors?: number;
  separator?: 'none' | 'comma' | 'slash' | 'pipe';
}

export function PostAuthorLinks({
  authors,
  unknownLabel,
  textSize = 'xs',
  textColor,
  avatarSize = 'xs',
  showAvatars = true,
  maxVisibleAuthors,
  separator,
}: PostAuthorLinksProps) {
  return (
    <UserInlineLinks
      users={authors}
      unknownLabel={unknownLabel}
      textSize={textSize}
      textColor={textColor}
      avatarSize={avatarSize}
      showAvatars={showAvatars}
      maxVisibleUsers={maxVisibleAuthors}
      separator={separator}
    />
  );
}
