import { UserInlineLinks, type UserInlineLinkUser } from '@/features/user/UserInlineLinks';

export type PostAuthorLinkAuthor = UserInlineLinkUser;

interface PostAuthorLinksProps {
  authors: PostAuthorLinkAuthor[];
  unknownLabel: string;
  textSize?: 'xs' | 'sm';
  textColor?: string;
  avatarSize?: number;
  avatarBorderColor?: string;
  showAvatars?: boolean;
  maxVisibleAuthors?: number;
  separator?: 'none' | 'comma' | 'slash' | 'pipe';
}

export function PostAuthorLinks({
  authors,
  unknownLabel,
  textSize = 'xs',
  textColor,
  avatarSize = 18,
  avatarBorderColor,
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
      avatarBorderColor={avatarBorderColor}
      showAvatars={showAvatars}
      maxVisibleUsers={maxVisibleAuthors}
      separator={separator}
    />
  );
}
