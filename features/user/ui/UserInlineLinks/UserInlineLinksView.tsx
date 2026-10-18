'use client';
import type { MouseEvent, ReactNode } from 'react';
import { LayoutInline } from '@/components/core/Layout';
import { Text, type TextTone } from '@/components/core/Typography';
import { Avatar, type AvatarSize } from '@/components/core/Display';
import { TextButton } from '@/components/core/TextButton';
export interface UserInlineLinkViewModel {
  id: string;
  href: string;
  label: string;
  avatarSrc: string | null;
  /** Display name for the Avatar's Core-derived fallback initial. */
  avatarName: string | null;
}
export interface UserInlineLinksViewProps {
  users: UserInlineLinkViewModel[];
  textSize?: 'xs' | 'sm';
  textColor?: TextTone;
  avatarSize?: AvatarSize;
  showAvatars?: boolean;
  maxVisibleUsers?: number;
  overflowLabel?: string | ((hiddenCount: number) => string);
  separator?: 'none' | 'comma' | 'slash' | 'pipe';
}
function stopCardNavigation(event: MouseEvent<HTMLElement>) {
  event.stopPropagation();
}
export function UserInlineLinksView({
  users,
  textSize = 'xs',
  textColor,
  avatarSize = 'xs',
  showAvatars = true,
  maxVisibleUsers,
  overflowLabel,
  separator = 'none',
}: UserInlineLinksViewProps) {
  if (users.length === 0) {
    return null;
  }
  const visibleUsers =
    typeof maxVisibleUsers === 'number' && maxVisibleUsers > 0 ? users.slice(0, maxVisibleUsers) : users;
  const hiddenUserCount = Math.max(users.length - visibleUsers.length, 0);
  const resolvedOverflowLabel =
    hiddenUserCount > 0
      ? typeof overflowLabel === 'function'
        ? overflowLabel(hiddenUserCount)
        : overflowLabel || `+${hiddenUserCount}`
      : null;
  const separatorLabel = separator === 'comma' ? ', ' : separator === 'slash' ? '/' : separator === 'pipe' ? '|' : null;
  const items: ReactNode[] = [];
  visibleUsers.forEach((user, index) => {
    if (separatorLabel && index > 0) {
      items.push(
        <Text
          as="span"
          size={textSize}
          tone={textColor ?? 'inherit'}
          key={`separator-${user.id}`}
          nowrap
          // A comma reads as a pause; slash and pipe are visual boundaries that screen readers would announce.
          aria-hidden={separator === 'comma' ? undefined : true}
        >
          {separatorLabel}
        </Text>,
      );
    }
    items.push(
      <span key={user.id} role="presentation" onClick={stopCardNavigation}>
        {/* An inline link in running metadata: its line box follows the text, like the neighbouring rows. */}
        <TextButton
          href={user.href}
          size={textSize}
          tone={textColor ?? 'inherit'}
          display="inline"
          aria-label={user.label}
        >
          {showAvatars ? (
            <>
              <Avatar src={user.avatarSrc} size={avatarSize} shape="circle" interactive name={user.avatarName} />{' '}
            </>
          ) : null}
          <Text as="span" size={textSize} tone="inherit" nowrap>
            {user.label}
          </Text>
        </TextButton>
      </span>,
    );
  });
  if (resolvedOverflowLabel) {
    if (separatorLabel && items.length > 0) {
      items.push(
        <Text as="span" size={textSize} tone={textColor ?? 'inherit'} key="separator-overflow" nowrap>
          {separatorLabel}
        </Text>,
      );
    }
    items.push(
      <Text as="span" size={textSize} tone={textColor ?? 'inherit'} key="overflow" nowrap>
        {resolvedOverflowLabel}
      </Text>,
    );
  }
  return (
    <LayoutInline gap="xxs" wrap="wrap">
      {items}
    </LayoutInline>
  );
}
