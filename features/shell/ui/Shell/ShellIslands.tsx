'use client';

// Client islands of the public shell. The server-rendered `ShellLayout` places them; each reads
// open state, session user, theme, route and events from `useShellState()`. Overlays use the
// on-demand Core variants, so menu, tooltip and drawer code loads on first hover/focus/press.

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconLogout, IconMoon, IconSearch, IconSun } from '@tabler/icons-react';
import { ApplicationFrame } from '@/components/core/ApplicationFrame';
import { Avatar, Separator as Divider } from '@/components/core/Display';
import { Button } from '@/components/core/Button';
import { OnDemandDrawer, preloadDrawer } from '@/components/core/Drawer/OnDemandDrawer';
import { useDrawerDesktop } from '@/components/core/Drawer/drawer-visibility';
import { OnDemandDropdownMenu } from '@/components/core/DropdownMenu/OnDemandDropdownMenu';
import { IconButton } from '@/components/core/IconButton';
import {
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';
import { MenuToggle } from '@/components/core/MenuToggle';
import { NavigationLink } from '@/components/core/Navigation';
import { TextButton, type TextButtonProps } from '@/components/core/TextButton';
import { OnDemandTooltip } from '@/components/core/Tooltip/OnDemandTooltip';
import { Text as DsText, VisuallyHidden } from '@/components/core/Typography';
import { tokenVar } from '@/components/core/design-tokens';
import { onDemandModule, useOnDemandModule } from '@/components/core/on-demand-module';
import { useShellState } from './shell-state';
import type { ShellViewNavigationItem, ShellViewUser } from './shell-types';
import headerClasses from './HeaderMenu.module.css';
import classes from './Shell.module.css';

export const MOBILE_NAVIGATION_ID = 'shell-mobile-navigation';

function linkTarget(item: ShellViewNavigationItem) {
  return item.openInNewTab ? '_blank' : undefined;
}

function linkRel(item: ShellViewNavigationItem) {
  return item.openInNewTab ? 'noopener noreferrer' : undefined;
}

interface ShellLinkProps {
  href: string;
  children: ReactNode;
  appearance?: TextButtonProps['appearance'];
  size?: TextButtonProps['size'];
  controlSize?: TextButtonProps['controlSize'];
  density?: TextButtonProps['density'];
  nowrap?: boolean;
  target?: string;
  rel?: string;
}

/** A shell text link; completing navigation closes the navigation drawer and account menu. */
export function ShellLink({
  href,
  children,
  appearance,
  size,
  controlSize,
  density,
  nowrap,
  target,
  rel,
}: ShellLinkProps) {
  const { events } = useShellState();
  return (
    <TextButton
      href={href}
      appearance={appearance}
      size={size}
      controlSize={controlSize}
      density={density}
      nowrap={nowrap}
      target={target}
      rel={rel}
      onNavigate={() => events.onNavigate(href)}
    >
      {children}
    </TextButton>
  );
}

export function ShellHomeLink({ label, children }: { label: string; children: ReactNode }) {
  const { events } = useShellState();
  return (
    <NavigationLink href="/" appearance="block" aria-label={label} onNavigate={() => events.onNavigate('/')}>
      {children}
    </NavigationLink>
  );
}

/** The drawer's navigation list (Disclosure groups) loads with the drawer, not with the page. */
const mobileNavigation = onDemandModule(() => import('./ShellMobileNavigation'));
export const preloadShellNavigation = mobileNavigation.preload;

export function ShellNavigationToggle({ label }: { label: string }) {
  const { navigationOpened, events } = useShellState();
  const toggle = useRef<HTMLButtonElement>(null);
  // Start loading the navigation list on intent; Core ApplicationFrame preloads the drawer itself.
  useEffect(() => {
    const button = toggle.current;
    const preload = () => void mobileNavigation.preload();
    const types = ['pointerenter', 'focus', 'pointerdown'] as const;
    types.forEach((type) => button?.addEventListener(type, preload));
    return () => types.forEach((type) => button?.removeEventListener(type, preload));
  }, []);
  return (
    <MenuToggle
      ref={toggle}
      opened={navigationOpened}
      onClick={events.onToggleNavigation}
      label={label}
      visibility="mobile-only"
      controls={MOBILE_NAVIGATION_ID}
    />
  );
}

export function ShellSearchAction({ label, variant }: { label: string; variant: 'desktop' | 'mobile' }) {
  const { events, labels } = useShellState();
  const intent = events.onSearchIntent;
  const button = (
    <IconButton
      size="chrome"
      onClick={events.onSearch}
      aria-label={label}
      onPointerEnter={intent}
      onFocus={intent}
      onPointerDown={intent}
    >
      <IconSearch size={16} aria-hidden />
    </IconButton>
  );
  return variant === 'desktop' ? <OnDemandTooltip label={labels.searchTooltip}>{button}</OnDemandTooltip> : button;
}

function ThemeIcon() {
  return (
    <span className={classes.themeIcon} aria-hidden>
      <IconMoon
        className={classes.themeIconLight}
        data-theme-icon-when="light"
        size={16}
        color={tokenVar('text-secondary')}
      />
      <IconSun
        className={classes.themeIconDark}
        data-theme-icon-when="dark"
        size={16}
        color={tokenVar('text-secondary')}
      />
    </span>
  );
}

export function ShellThemeToggle({ label, variant }: { label: string; variant: 'desktop' | 'mobile' }) {
  const { events, labels } = useShellState();
  const button = (
    <IconButton size="chrome" onClick={events.onToggleColorScheme} aria-label={label}>
      <ThemeIcon />
    </IconButton>
  );
  return variant === 'desktop' ? <OnDemandTooltip label={labels.themeTooltip}>{button}</OnDemandTooltip> : button;
}

function UserSummary({ user, size }: { user: ShellViewUser; size: 'compact' | 'mobile' | 'detail' }) {
  const avatarSize = size === 'detail' ? 'md' : size === 'mobile' ? 'sm' : 'xs';

  return (
    <DsLayoutInline gap={size === 'compact' ? 'xs' : 'sm'} wrap="nowrap">
      <Avatar src={user.imageUrls[size]} shape="circle" size={avatarSize} name={user.name} />
      {size !== 'mobile' ? (
        <div style={{ minWidth: 0, flex: size === 'detail' ? 1 : undefined }}>
          <DsLayoutInset block="xxs">
            <DsText as="span" size="xs" tone="secondary">
              {user.name}
            </DsText>
          </DsLayoutInset>
          {size === 'detail' && user.email ? (
            <DsText size="xs" tone="secondary" truncate>
              {user.email}
            </DsText>
          ) : null}
        </div>
      ) : null}
    </DsLayoutInline>
  );
}

interface AccountLabels {
  account: string;
  logOut: string;
  signIn: string;
}

export function ShellAccountDesktop({ items, labels }: { items: ShellViewNavigationItem[]; labels: AccountLabels }) {
  const { user, userMenuOpened, loginHref, events } = useShellState();
  const accountDescriptionId = useId();
  // Phones show the account drawer instead. The hidden desktop menu must neither open with the
  // shared state nor report a close that would dismiss that drawer.
  const desktop = useDrawerDesktop();
  const menuOpened = desktop && userMenuOpened;
  if (!user) {
    return (
      <TextButton
        href={loginHref}
        data-shell-login-action="desktop"
        size="xs"
        density="chrome"
        weight="medium"
        nowrap
        onNavigate={() => events.onNavigate(loginHref)}
      >
        {labels.signIn}
      </TextButton>
    );
  }
  if (user.kind !== 'authenticated') {
    return (
      <div className={classes.user}>
        <UserSummary user={user} size="compact" />
      </div>
    );
  }
  return (
    <OnDemandDropdownMenu
      size="wide"
      placement="bottom-end"
      opened={menuOpened}
      onChange={(opened) => {
        if (!desktop) {
          return;
        }
        if (opened) {
          events.onOpenUserMenu();
        } else {
          events.onCloseUserMenu();
        }
      }}
      portal
    >
      <OnDemandDropdownMenu.Target>
        <TextButton
          type="button"
          appearance="default"
          size="sm"
          density="chrome"
          data-interactive
          selected={menuOpened}
          aria-label={user.name}
          aria-describedby={accountDescriptionId}
        >
          <UserSummary user={user} size="compact" />
          <VisuallyHidden id={accountDescriptionId}>{labels.account}</VisuallyHidden>
        </TextButton>
      </OnDemandDropdownMenu.Target>
      <OnDemandDropdownMenu.Dropdown data-shell-user-menu>
        <OnDemandDropdownMenu.Label>
          <UserSummary user={user} size="detail" />
        </OnDemandDropdownMenu.Label>
        <OnDemandDropdownMenu.Divider />
        {items.map((item) => (
          <OnDemandDropdownMenu.Item
            key={item.id}
            href={item.href}
            target={linkTarget(item)}
            rel={linkRel(item)}
            onClick={() => events.onNavigate(item.href)}
          >
            {item.label}
          </OnDemandDropdownMenu.Item>
        ))}
        {items.length > 0 ? <OnDemandDropdownMenu.Divider /> : null}
        <OnDemandDropdownMenu.Item icon={<IconLogout size={16} aria-hidden />} tone="danger" onClick={events.onSignOut}>
          {labels.logOut}
        </OnDemandDropdownMenu.Item>
      </OnDemandDropdownMenu.Dropdown>
    </OnDemandDropdownMenu>
  );
}

export function ShellAccountMobile({ labels }: { labels: AccountLabels }) {
  const { user, userMenuOpened, loginHref, events } = useShellState();
  if (!user) {
    return (
      <TextButton
        href={loginHref}
        data-shell-login-action="mobile"
        size="xs"
        density="chrome"
        weight="medium"
        nowrap
        onNavigate={() => events.onNavigate(loginHref)}
      >
        {labels.signIn}
      </TextButton>
    );
  }
  if (user.kind !== 'authenticated') {
    return (
      <div className={classes.mobileUserTrigger}>
        <UserSummary user={user} size="mobile" />
      </div>
    );
  }
  return (
    <IconButton
      size="chrome"
      onClick={events.onOpenUserMenu}
      aria-label={labels.account}
      aria-expanded={userMenuOpened}
      onPointerEnter={preloadDrawer}
      onFocus={preloadDrawer}
      onPointerDown={preloadDrawer}
    >
      <UserSummary user={user} size="mobile" />
    </IconButton>
  );
}

export function ShellDesktopNavigation({ items, label }: { items: ShellViewNavigationItem[]; label: string }) {
  const { isItemActive, events } = useShellState();
  return (
    <nav className={headerClasses.nav} aria-label={label} data-shell-desktop-navigation>
      {items.map((item) => {
        const active = isItemActive(item);
        if (item.children.length > 0) {
          return (
            <OnDemandDropdownMenu key={item.id} trigger="hover" portal>
              <OnDemandDropdownMenu.Target>
                <TextButton
                  type="button"
                  appearance="default"
                  size="xs"
                  weight="medium"
                  display="flex"
                  density="chrome"
                  selected={active}
                  indicator="menu"
                >
                  {item.label}
                </TextButton>
              </OnDemandDropdownMenu.Target>
              <OnDemandDropdownMenu.Dropdown>
                {item.children.map((child) => (
                  <OnDemandDropdownMenu.Item
                    key={child.id}
                    href={child.href}
                    target={linkTarget(child)}
                    rel={linkRel(child)}
                    aria-current={isItemActive(child) ? 'page' : undefined}
                    onClick={() => events.onNavigate(child.href)}
                  >
                    {child.label}
                  </OnDemandDropdownMenu.Item>
                ))}
              </OnDemandDropdownMenu.Dropdown>
            </OnDemandDropdownMenu>
          );
        }

        return (
          <TextButton
            key={item.id}
            href={item.href}
            density="chrome"
            display="flex"
            selected={active}
            aria-current={active ? 'page' : undefined}
            target={linkTarget(item)}
            rel={linkRel(item)}
            onNavigate={() => events.onNavigate(item.href)}
          >
            {item.label}
          </TextButton>
        );
      })}
    </nav>
  );
}

function AccountMenuContent({
  user,
  items,
  labels,
}: {
  user: ShellViewUser;
  items: ShellViewNavigationItem[];
  labels: { logOut: string };
}) {
  const { events } = useShellState();
  return (
    <DsLayoutStack gap="xs">
      <DsLayoutInset space="xs">
        <DsLayoutInline gap="xs">
          <UserSummary user={user} size="detail" />
        </DsLayoutInline>
      </DsLayoutInset>
      <Divider />
      <DsLayoutInset space="xxs">
        <DsLayoutStack gap="none">
          {items.map((item) => (
            <TextButton
              key={item.id}
              href={item.href}
              density="chrome"
              display="flex"
              fullWidth
              justify="start"
              target={linkTarget(item)}
              rel={linkRel(item)}
              onNavigate={() => events.onNavigate(item.href)}
            >
              <DsText size="xs">{item.label}</DsText>
            </TextButton>
          ))}
          {items.length > 0 ? <Divider spaceBefore="xs" spaceAfter="xs" /> : null}
          <Button
            type="button"
            tone="danger"
            emphasis="low"
            size="xs"
            fullWidth
            justify="start"
            leftSection={<IconLogout size={16} aria-hidden />}
            onClick={events.onSignOut}
          >
            {labels.logOut}
          </Button>
        </DsLayoutStack>
      </DsLayoutInset>
    </DsLayoutStack>
  );
}

/** Application frame with the shell's state attributes, navigation drawer and mobile account drawer. */
export function ShellFrame({
  header,
  headerItems,
  secondaryItems,
  footer,
  accountItems,
  labels,
  children,
}: {
  header: ReactNode;
  headerItems: ShellViewNavigationItem[];
  secondaryItems: ShellViewNavigationItem[];
  footer: ReactNode;
  accountItems: ShellViewNavigationItem[];
  labels: { navigation: string; close: string; account: string; logOut: string };
  children: ReactNode;
}) {
  const { navigationOpened, userMenuOpened, themeMode, user, events } = useShellState();
  const authenticated = user?.kind === 'authenticated';
  // The drawer opens once its navigation list is available, so it never opens empty.
  const navigation = useOnDemandModule(mobileNavigation, navigationOpened);
  return (
    <ApplicationFrame
      kind="site"
      id="app-shell"
      data-shell
      data-navigation-opened={navigationOpened}
      data-user-menu-opened={userMenuOpened}
      data-user-state={user?.kind ?? 'anonymous'}
      data-theme-mode={themeMode ?? 'pending'}
      header={header}
      navigation={
        navigation ? (
          <>
            <navigation.ShellMobileNavigation headerItems={headerItems} secondaryItems={secondaryItems} />
          </>
        ) : null
      }
      navigationOpened={navigationOpened && Boolean(navigation)}
      onCloseNavigation={events.onToggleNavigation}
      navigationLabel={labels.navigation}
      closeLabel={labels.close}
      navigationId={MOBILE_NAVIGATION_ID}
      footer={footer}
    >
      {children}

      {authenticated && user ? (
        <OnDemandDrawer
          opened={userMenuOpened}
          onClose={events.onCloseUserMenu}
          placement="bottom"
          size="auto"
          title={labels.account}
          closeLabel={labels.close}
          visibility="mobile-only"
        >
          <AccountMenuContent user={user} items={accountItems} labels={labels} />
        </OnDemandDrawer>
      ) : null}
    </ApplicationFrame>
  );
}

export function ShellCookieSettingsButton({ label }: { label: string }) {
  const { events } = useShellState();
  return (
    <TextButton appearance="muted" size="xs" controlSize="xs" onClick={events.onOpenCookieSettings}>
      {label}
    </TextButton>
  );
}

/** Shown to authors and administrators only. */
export function ShellChangelogLink({ label }: { label: string }) {
  const { showChangelog, events } = useShellState();
  return showChangelog ? (
    <TextButton
      href="/changelog"
      appearance="muted"
      size="xs"
      controlSize="xs"
      onNavigate={() => events.onNavigate('/changelog')}
    >
      {label}
    </TextButton>
  ) : null;
}
