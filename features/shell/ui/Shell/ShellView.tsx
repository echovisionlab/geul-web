'use client';

import type { ElementType, ReactNode } from 'react';
import { IconChevronDown, IconLogout, IconMoon, IconSearch, IconSun } from '@tabler/icons-react';
import { AppShell, Avatar, Box, Divider, Group, Stack, Text, VisuallyHidden } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { Disclosure } from '@/components/core/Disclosure';
import { Drawer } from '@/components/core/Drawer';
import { IconButton } from '@/components/core/IconButton';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { MenuToggle } from '@/components/core/MenuToggle';
import { TextButton } from '@/components/core/TextButton';
import { Tooltip } from '@/components/core/Tooltip';
import headerClasses from './HeaderMenu.module.css';
import classes from './Shell.module.css';
import viewClasses from './ShellView.module.css';

const MOBILE_NAVIGATION_ID = 'shell-mobile-navigation';

export interface ShellViewNavigationItem {
  id: string;
  label: string;
  href: string;
  active: boolean;
  openInNewTab: boolean;
  children: ShellViewNavigationItem[];
}

export interface ShellViewUser {
  kind: 'snapshot' | 'authenticated';
  name: string;
  email: string | null;
  imageUrls: {
    compact: string | null;
    mobile: string | null;
    detail: string | null;
  };
}

export interface ShellViewFooter {
  siteTitle: string;
  description: string | null;
  copyright: string;
  taxId: string | null;
  companyAddress: string | null;
  version: string;
  showChangelog: boolean;
}

export interface ShellViewLabels {
  navigation: string;
  toggleNavigation: string;
  close: string;
  search: string;
  searchTooltip: string;
  signIn: string;
  account: string;
  logOut: string;
  toggleColorScheme: string;
  themeTooltip: string;
  cookieSettings: string;
  changelog: string;
  newsletter: string;
  footerSiteInfo: string;
  footerLinks: string;
  footerSocialMedia: string;
}

export interface ShellViewEvents {
  onToggleNavigation: () => void;
  onOpenUserMenu: () => void;
  onCloseUserMenu: () => void;
  onSearch: () => void;
  onToggleColorScheme: () => void;
  onSignOut: () => void | Promise<void>;
  onOpenCookieSettings: () => void;
  onNavigate: (href: string) => void;
}

export interface ShellViewSlots {
  logo: ReactNode;
  printHeader: ReactNode;
  printWatermark: ReactNode;
  languageDesktop: ReactNode;
  languageMobile: ReactNode;
  languageFooterDesktop: ReactNode;
  languageFooterMobile: ReactNode;
  socialLinks: ReactNode;
}

export interface ShellViewProps {
  children: ReactNode;
  loginHref: string;
  navigationOpened: boolean;
  userMenuOpened: boolean;
  themeMode: 'light' | 'dark' | null;
  user: ShellViewUser | null;
  headerItems: ShellViewNavigationItem[];
  secondaryItems: ShellViewNavigationItem[];
  footerItems: ShellViewNavigationItem[];
  accountItems: ShellViewNavigationItem[];
  footer: ShellViewFooter;
  labels: ShellViewLabels;
  events: ShellViewEvents;
  slots: ShellViewSlots;
  linkComponent?: ElementType;
}

function linkTarget(item: ShellViewNavigationItem) {
  return item.openInNewTab ? '_blank' : undefined;
}

function linkRel(item: ShellViewNavigationItem) {
  return item.openInNewTab ? 'noopener noreferrer' : undefined;
}

function DesktopNavigation({
  items,
  label,
  linkComponent: LinkComponent,
  onNavigate,
}: {
  items: ShellViewNavigationItem[];
  label: string;
  linkComponent: ElementType;
  onNavigate: (href: string) => void;
}) {
  return (
    <nav className={headerClasses.nav} aria-label={label} data-shell-desktop-navigation>
      {items.map((item) => {
        if (item.children.length > 0) {
          return (
            <DropdownMenu key={item.id} trigger="hover" portal>
              <DropdownMenu.Target>
                <TextButton
                  type="button"
                  appearance="default"
                  size="xs"
                  weight="medium"
                  display="flex"
                  className={headerClasses.link}
                  data-active={item.active || undefined}
                >
                  <Group gap={5} wrap="nowrap">
                    <span className={headerClasses.linkLabel}>{item.label}</span>
                    <IconChevronDown size={16} stroke={1.5} aria-hidden />
                  </Group>
                </TextButton>
              </DropdownMenu.Target>
              <DropdownMenu.Dropdown>
                {item.children.map((child) => (
                  <DropdownMenu.Item
                    key={child.id}
                    component={LinkComponent as 'a'}
                    href={child.href}
                    target={linkTarget(child)}
                    rel={linkRel(child)}
                    aria-current={child.active ? 'page' : undefined}
                    onClick={() => onNavigate(child.href)}
                  >
                    {child.label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Dropdown>
            </DropdownMenu>
          );
        }

        return (
          <LinkComponent
            key={item.id}
            href={item.href}
            className={headerClasses.link}
            data-active={item.active || undefined}
            aria-current={item.active ? 'page' : undefined}
            target={linkTarget(item)}
            rel={linkRel(item)}
            onClick={() => onNavigate(item.href)}
          >
            {item.label}
          </LinkComponent>
        );
      })}
    </nav>
  );
}

function MobileNavigation({
  headerItems,
  secondaryItems,
  linkComponent: LinkComponent,
  onNavigate,
}: {
  headerItems: ShellViewNavigationItem[];
  secondaryItems: ShellViewNavigationItem[];
  linkComponent: ElementType;
  onNavigate: (href: string) => void;
}) {
  const renderLink = (item: ShellViewNavigationItem) => (
    <LinkComponent
      key={item.id}
      href={item.href}
      className={classes.navLink}
      data-active={item.active || undefined}
      aria-current={item.active ? 'page' : undefined}
      target={linkTarget(item)}
      rel={linkRel(item)}
      onClick={() => onNavigate(item.href)}
    >
      <Text size="xs">{item.label}</Text>
    </LinkComponent>
  );

  return (
    <Stack gap={2} data-shell-mobile-navigation>
      {headerItems.map((item) =>
        item.children.length > 0 ? (
          <Disclosure
            key={item.id}
            label={item.label}
            appearance="filled"
            density="compact"
            shape="square"
            contentIndent="small"
          >
            <Stack gap={0}>{item.children.map(renderLink)}</Stack>
          </Disclosure>
        ) : (
          renderLink(item)
        ),
      )}
      {secondaryItems.length > 0 ? (
        <>
          <Divider my="xs" />
          {secondaryItems.map(renderLink)}
        </>
      ) : null}
    </Stack>
  );
}

function UserSummary({ user, size }: { user: ShellViewUser; size: 'compact' | 'mobile' | 'detail' }) {
  const avatarSize = size === 'detail' ? 'md' : size === 'mobile' ? 'sm' : 20;

  return (
    <Group gap={size === 'compact' ? 7 : 'sm'} wrap="nowrap">
      <Avatar src={user.imageUrls[size]} radius="xl" size={avatarSize}>
        {user.name.charAt(0).toUpperCase()}
      </Avatar>
      {size !== 'mobile' ? (
        <div style={{ minWidth: 0, flex: size === 'detail' ? 1 : undefined }}>
          <Text fw={500} size="xs" lh={size === 'compact' ? 1 : undefined} truncate>
            {user.name}
          </Text>
          {size === 'detail' && user.email ? (
            <Text size="xs" c="dimmed" truncate>
              {user.email}
            </Text>
          ) : null}
        </div>
      ) : null}
    </Group>
  );
}

function AccountMenuContent({
  user,
  items,
  labels,
  linkComponent: LinkComponent,
  events,
}: {
  user: ShellViewUser;
  items: ShellViewNavigationItem[];
  labels: ShellViewLabels;
  linkComponent: ElementType;
  events: ShellViewEvents;
}) {
  return (
    <Stack gap="xs">
      <Group p="xs" gap="xs">
        <UserSummary user={user} size="detail" />
      </Group>
      <Divider />
      <Stack gap={0} p={4}>
        {items.map((item) => (
          <LinkComponent
            key={item.id}
            href={item.href}
            className={classes.menuItem}
            target={linkTarget(item)}
            rel={linkRel(item)}
            onClick={() => events.onNavigate(item.href)}
          >
            <Text size="xs">{item.label}</Text>
          </LinkComponent>
        ))}
        {items.length > 0 ? <Divider my="xs" /> : null}
        <Button
          type="button"
          tone="danger"
          emphasis="low"
          size="xs"
          fullWidth
          justify="flex-start"
          leftSection={<IconLogout size={16} aria-hidden />}
          onClick={events.onSignOut}
        >
          {labels.logOut}
        </Button>
      </Stack>
    </Stack>
  );
}

function Footer({
  items,
  footer,
  labels,
  slots,
  events,
  linkComponent: LinkComponent,
}: {
  items: ShellViewNavigationItem[];
  footer: ShellViewFooter;
  labels: ShellViewLabels;
  slots: ShellViewSlots;
  events: ShellViewEvents;
  linkComponent: ElementType;
}) {
  const footerLinks = items.map((item) => (
    <TextButton
      key={item.id}
      href={item.href}
      linkComponent={LinkComponent}
      appearance="muted"
      size="xs"
      controlSize="xs"
      target={linkTarget(item)}
      rel={linkRel(item)}
      onNavigate={() => events.onNavigate(item.href)}
    >
      {item.label}
    </TextButton>
  ));

  const footerActions = (languageControl: ReactNode) => (
    <>
      {languageControl}
      <TextButton
        href="/login?intent=newsletter"
        linkComponent={LinkComponent}
        appearance="muted"
        size="xs"
        controlSize="xs"
        onNavigate={() => events.onNavigate('/login?intent=newsletter')}
      >
        {labels.newsletter}
      </TextButton>
      <TextButton appearance="muted" size="xs" controlSize="xs" onClick={events.onOpenCookieSettings}>
        {labels.cookieSettings}
      </TextButton>
      {footer.showChangelog ? (
        <TextButton
          href="/changelog"
          linkComponent={LinkComponent}
          appearance="muted"
          size="xs"
          controlSize="xs"
          onNavigate={() => events.onNavigate('/changelog')}
        >
          {labels.changelog}
        </TextButton>
      ) : null}
      <Text component="span" size="xs" c="dimmed" className={classes.footerVersion}>
        {footer.version}
      </Text>
    </>
  );

  return (
    <footer className={`${classes.footer} print-hide`} data-shell-footer>
      <Box visibleFrom="sm">
        <div className={classes.footerGrid}>
          <Stack component="section" aria-labelledby="footer-brand-desktop">
            <VisuallyHidden component="h2" id="footer-brand-desktop">
              {labels.footerSiteInfo}
            </VisuallyHidden>
            <Text size="xs" c="dimmed">
              {footer.siteTitle}
            </Text>
            {footer.description ? (
              <Text size="xs" c="dimmed">
                {footer.description}
              </Text>
            ) : null}
          </Stack>

          <Stack component="nav" aria-labelledby="footer-links-desktop" gap="xs">
            <VisuallyHidden component="h2" id="footer-links-desktop">
              {labels.footerLinks}
            </VisuallyHidden>
            {footerLinks}
          </Stack>

          <Stack component="section" aria-labelledby="footer-social-desktop" gap="xs">
            <VisuallyHidden component="h2" id="footer-social-desktop">
              {labels.footerSocialMedia}
            </VisuallyHidden>
            {slots.socialLinks}
          </Stack>
        </div>

        <Box className={classes.footerBottom}>
          <Group justify="space-between" align="center" gap="md" wrap="wrap">
            <Group gap="md" wrap="wrap">
              <Text size="xs" c="dimmed" suppressHydrationWarning>
                {footer.copyright}
              </Text>
              {footer.taxId ? (
                <Text size="xs" c="dimmed">
                  {footer.taxId}
                </Text>
              ) : null}
              {footer.companyAddress ? (
                <Text size="xs" c="dimmed">
                  {footer.companyAddress}
                </Text>
              ) : null}
            </Group>
            <Group gap="xs" wrap="wrap" className={classes.footerActions}>
              {footerActions(slots.languageFooterDesktop)}
            </Group>
          </Group>
        </Box>
      </Box>

      <Stack hiddenFrom="sm" align="center" gap="xs">
        <Group justify="center" gap="sm" wrap="wrap">
          {footerLinks}
        </Group>
        <Text size="xs" c="dimmed" suppressHydrationWarning>
          {footer.copyright}
          {footer.taxId ? ` · ${footer.taxId}` : ''}
        </Text>
        <Group justify="center" gap="xs" wrap="wrap" className={classes.footerMobileActions}>
          {footerActions(slots.languageFooterMobile)}
        </Group>
      </Stack>
    </footer>
  );
}

/** Pure, display-ready shell for public pages. Runtime state and side effects live in Shell.tsx. */
export function ShellView({
  children,
  loginHref,
  navigationOpened,
  userMenuOpened,
  themeMode,
  user,
  headerItems,
  secondaryItems,
  footerItems,
  accountItems,
  footer,
  labels,
  events,
  slots,
  linkComponent,
}: ShellViewProps) {
  const LinkComponent = linkComponent ?? 'a';
  const authenticated = user?.kind === 'authenticated';
  const themeIconSmall = (
    <span className={classes.themeIcon} aria-hidden>
      <IconMoon className={classes.themeIconLight} data-theme-icon-when="light" size={16} color="#5C6BC0" />
      <IconSun className={classes.themeIconDark} data-theme-icon-when="dark" size={16} color="#FFA500" />
    </span>
  );
  const userTrigger = user ? (
    authenticated ? (
      <TextButton
        type="button"
        appearance="default"
        size="sm"
        className={classes.user}
        data-interactive
        data-active={userMenuOpened || undefined}
        aria-label={labels.account}
      >
        <UserSummary user={user} size="compact" />
      </TextButton>
    ) : (
      <div className={classes.user}>
        <UserSummary user={user} size="compact" />
      </div>
    )
  ) : null;

  return (
    <div
      className={classes.shellWrapper}
      data-shell
      data-navigation-opened={navigationOpened}
      data-user-menu-opened={userMenuOpened}
      data-user-state={user?.kind ?? 'anonymous'}
      data-theme-mode={themeMode ?? 'pending'}
    >
      <AppShell
        id="app-shell"
        padding="md"
        header={{ height: { base: 52, sm: 64 } }}
        navbar={{
          width: 280,
          breakpoint: 'sm',
          collapsed: { desktop: true, mobile: !navigationOpened },
        }}
        classNames={{ root: classes.appShellRoot }}
      >
        <AppShell.Header className={classes.header} data-shell-header>
          <Group h="100%" px="sm" justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
              <MenuToggle
                opened={navigationOpened}
                onClick={events.onToggleNavigation}
                label={labels.toggleNavigation}
                size="compact"
                visibility="mobile-only"
                controls={MOBILE_NAVIGATION_ID}
              />
              <LinkComponent
                href="/"
                style={{ height: '100%', display: 'flex', alignItems: 'center' }}
                onClick={() => events.onNavigate('/')}
              >
                {slots.logo}
              </LinkComponent>
            </Group>

            <Box className={classes.links} visibleFrom="sm">
              <Group justify="flex-end" gap="xs" wrap="nowrap">
                {secondaryItems.map((item) => (
                  <LinkComponent
                    key={item.id}
                    href={item.href}
                    className={classes.secondaryLink}
                    target={linkTarget(item)}
                    rel={linkRel(item)}
                    onClick={() => events.onNavigate(item.href)}
                  >
                    {item.label}
                  </LinkComponent>
                ))}
                <Tooltip label={labels.searchTooltip}>
                  <IconButton size={32} onClick={events.onSearch} aria-label={labels.search}>
                    <IconSearch size={16} aria-hidden />
                  </IconButton>
                </Tooltip>
                {slots.languageDesktop}
                <Tooltip label={labels.themeTooltip}>
                  <IconButton size={32} onClick={events.onToggleColorScheme} aria-label={labels.toggleColorScheme}>
                    {themeIconSmall}
                  </IconButton>
                </Tooltip>
                {user ? (
                  authenticated ? (
                    <DropdownMenu
                      size="wide"
                      placement="bottom-end"
                      opened={userMenuOpened}
                      onChange={(opened) => {
                        if (opened) {
                          events.onOpenUserMenu();
                        } else {
                          events.onCloseUserMenu();
                        }
                      }}
                      portal
                    >
                      <DropdownMenu.Target>{userTrigger}</DropdownMenu.Target>
                      <DropdownMenu.Dropdown data-shell-user-menu>
                        <DropdownMenu.Label>
                          <UserSummary user={user} size="detail" />
                        </DropdownMenu.Label>
                        <DropdownMenu.Divider />
                        {accountItems.map((item) => (
                          <DropdownMenu.Item
                            key={item.id}
                            component={LinkComponent as 'a'}
                            href={item.href}
                            target={linkTarget(item)}
                            rel={linkRel(item)}
                            onClick={() => events.onNavigate(item.href)}
                          >
                            {item.label}
                          </DropdownMenu.Item>
                        ))}
                        {accountItems.length > 0 ? <DropdownMenu.Divider /> : null}
                        <DropdownMenu.Item
                          icon={<IconLogout size={16} aria-hidden />}
                          tone="danger"
                          onClick={events.onSignOut}
                        >
                          {labels.logOut}
                        </DropdownMenu.Item>
                      </DropdownMenu.Dropdown>
                    </DropdownMenu>
                  ) : (
                    userTrigger
                  )
                ) : (
                  <TextButton
                    linkComponent={LinkComponent}
                    href={loginHref}
                    className={classes.loginAction}
                    data-shell-login-action="desktop"
                    size="xs"
                    controlSize="sm"
                    weight="medium"
                    nowrap
                    onNavigate={() => events.onNavigate(loginHref)}
                  >
                    {labels.signIn}
                  </TextButton>
                )}
              </Group>
              <Group gap={0} justify="flex-start" className={classes.mainLinks}>
                <DesktopNavigation
                  items={headerItems}
                  label={labels.navigation}
                  linkComponent={LinkComponent}
                  onNavigate={events.onNavigate}
                />
              </Group>
            </Box>

            <Group gap="xs" hiddenFrom="sm" wrap="nowrap">
              <IconButton size={32} onClick={events.onSearch} aria-label={labels.search}>
                <IconSearch size={16} aria-hidden />
              </IconButton>
              {slots.languageMobile}
              <IconButton size={32} onClick={events.onToggleColorScheme} aria-label={labels.toggleColorScheme}>
                {themeIconSmall}
              </IconButton>
              {user ? (
                authenticated ? (
                  <IconButton
                    size={32}
                    className={classes.mobileUserTrigger}
                    onClick={events.onOpenUserMenu}
                    aria-label={labels.account}
                    aria-expanded={userMenuOpened}
                  >
                    <UserSummary user={user} size="mobile" />
                  </IconButton>
                ) : (
                  <div className={classes.mobileUserTrigger}>
                    <UserSummary user={user} size="mobile" />
                  </div>
                )
              ) : (
                <TextButton
                  linkComponent={LinkComponent}
                  href={loginHref}
                  className={classes.loginAction}
                  data-shell-login-action="mobile"
                  size="xs"
                  controlSize="sm"
                  weight="medium"
                  nowrap
                  onNavigate={() => events.onNavigate(loginHref)}
                >
                  {labels.signIn}
                </TextButton>
              )}
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar id={MOBILE_NAVIGATION_ID} p="xs" aria-label={labels.navigation}>
          <MobileNavigation
            headerItems={headerItems}
            secondaryItems={secondaryItems}
            linkComponent={LinkComponent}
            onNavigate={events.onNavigate}
          />
        </AppShell.Navbar>

        <AppShell.Main className={classes.main}>
          <div className={viewClasses.printOnly}>{slots.printHeader}</div>
          <div className={`${viewClasses.printOnly} print-watermark`}>{slots.printWatermark}</div>
          {children}
        </AppShell.Main>

        {authenticated && user ? (
          <Drawer
            opened={userMenuOpened}
            onClose={events.onCloseUserMenu}
            placement="bottom"
            size="auto"
            title={labels.account}
            closeLabel={labels.close}
            visibility="mobile-only"
          >
            <AccountMenuContent
              user={user}
              items={accountItems}
              labels={labels}
              linkComponent={LinkComponent}
              events={events}
            />
          </Drawer>
        ) : null}
      </AppShell>

      <Footer
        items={footerItems}
        footer={footer}
        labels={labels}
        slots={slots}
        events={events}
        linkComponent={LinkComponent}
      />
    </div>
  );
}
