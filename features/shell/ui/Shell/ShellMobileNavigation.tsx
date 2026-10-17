'use client';

import type { ReactNode } from 'react';
// Navigation list of the site navigation drawer. Loaded on demand with the drawer (ShellFrame).

import { Disclosure } from '@/components/core/Disclosure';
import { Separator as Divider } from '@/components/core/Display';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { TextButton } from '@/components/core/TextButton';
import { Text as DsText } from '@/components/core/Typography';
import { useShellState } from './shell-state';
import type { ShellViewNavigationItem } from './shell-types';

function linkTarget(item: ShellViewNavigationItem) {
  return item.openInNewTab ? '_blank' : undefined;
}

function linkRel(item: ShellViewNavigationItem) {
  return item.openInNewTab ? 'noopener noreferrer' : undefined;
}

export function ShellMobileNavigation({
  headerItems,
  secondaryItems,
  footer,
}: {
  headerItems: ShellViewNavigationItem[];
  secondaryItems: ShellViewNavigationItem[];
  /** Settings below the links, such as the language menu the phone header leaves out. */
  footer?: ReactNode;
}) {
  const { isItemActive, events } = useShellState();
  const renderLink = (item: ShellViewNavigationItem, nested = false) => {
    const active = isItemActive(item);
    if (!item.href) {
      return <span key={item.id}>{item.label}</span>;
    }
    return (
      <TextButton
        key={item.id}
        nested={nested}
        href={item.href}
        density="chrome"
        display="flex"
        fullWidth
        justify="start"
        selected={active}
        aria-current={active ? 'page' : undefined}
        target={linkTarget(item)}
        rel={linkRel(item)}
        onNavigate={() => events.onNavigate(item.href)}
      >
        <DsText size="xs">{item.label}</DsText>
      </TextButton>
    );
  };

  return (
    <DsLayoutStack gap="none" data-shell-mobile-navigation>
      {headerItems.map((item) =>
        item.children.length > 0 ? (
          <Disclosure
            key={item.id}
            label={item.label}
            appearance="plain"
            density="chrome"
            withDivider={false}
            shape="square"
            contentIndent="label"
          >
            <DsLayoutStack gap="none">{item.children.map((child) => renderLink(child, true))}</DsLayoutStack>
          </Disclosure>
        ) : (
          renderLink(item)
        ),
      )}
      {secondaryItems.length > 0 ? (
        <>
          <Divider spaceBefore="xs" spaceAfter="xs" />
          {secondaryItems.map((item) => renderLink(item))}
        </>
      ) : null}
      {footer != null ? (
        <>
          <Divider spaceBefore="xs" spaceAfter="xs" />
          {footer}
        </>
      ) : null}
    </DsLayoutStack>
  );
}
