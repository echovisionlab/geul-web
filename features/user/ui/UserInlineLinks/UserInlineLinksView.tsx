'use client';

import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { Avatar, Group } from '@mantine/core';
import { TextButton } from '@/components/core/TextButton';
import classes from './UserInlineLinksView.module.css';

export interface UserInlineLinkViewModel {
  id: string;
  href: string;
  label: string;
  avatarSrc: string | null;
  avatarFallback: string | null;
}

export interface UserInlineLinksViewProps {
  users: UserInlineLinkViewModel[];
  textSize?: 'xs' | 'sm';
  textColor?: string;
  avatarSize?: number;
  avatarBorderColor?: string;
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
  avatarSize = 18,
  avatarBorderColor,
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
  const linkStyle = textColor ? ({ '--user-inline-link-color': textColor } as CSSProperties) : ({} as CSSProperties);

  if (avatarBorderColor) {
    linkStyle['--user-inline-avatar-border-color' as keyof CSSProperties] = avatarBorderColor as never;
  }

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
        <span key={`separator-${user.id}`} className={classes.separator} style={linkStyle}>
          {separatorLabel}
        </span>,
      );
    }

    items.push(
      <span key={user.id} role="presentation" onClick={stopCardNavigation}>
        <TextButton
          href={user.href}
          size={textSize}
          className={classes.userLink}
          style={linkStyle}
          aria-label={user.label}
        >
          {showAvatars ? (
            <Avatar src={user.avatarSrc} size={avatarSize} radius="xl" className={classes.userAvatar}>
              {user.avatarFallback}
            </Avatar>
          ) : null}
          <span className={classes.userLabel}>{user.label}</span>
        </TextButton>
      </span>,
    );
  });

  if (resolvedOverflowLabel) {
    if (separatorLabel && items.length > 0) {
      items.push(
        <span key="separator-overflow" className={classes.separator} style={linkStyle}>
          {separatorLabel}
        </span>,
      );
    }
    items.push(
      <span key="overflow" className={classes.userOverflowLabel} style={linkStyle}>
        {resolvedOverflowLabel}
      </span>,
    );
  }

  return (
    <Group gap={4} wrap="wrap" className={classes.userList}>
      {items}
    </Group>
  );
}
