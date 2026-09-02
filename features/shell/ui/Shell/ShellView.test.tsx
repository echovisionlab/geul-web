// @vitest-environment jsdom

import { act, forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextButton } from '@/components/core/TextButton';
import { TestProviders } from '@/test/TestProviders';
import { ShellView, type ShellViewNavigationItem, type ShellViewProps, type ShellViewUser } from './ShellView';

const TestLink = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<'a'>>(({ href, onClick, ...props }, ref) => (
  <a
    ref={ref}
    {...props}
    data-test-link-transport
    href={href}
    onClick={(event) => {
      event.preventDefault();
      onClick?.(event);
    }}
  />
));
TestLink.displayName = 'TestLink';

const events = {
  onToggleNavigation: vi.fn(),
  onOpenUserMenu: vi.fn(),
  onCloseUserMenu: vi.fn(),
  onSearch: vi.fn(),
  onToggleColorScheme: vi.fn(),
  onSignOut: vi.fn(),
  onOpenCookieSettings: vi.fn(),
  onNavigate: vi.fn(),
};

const navItem = (
  id: string,
  label: string,
  href: string,
  overrides: Partial<ShellViewNavigationItem> = {},
): ShellViewNavigationItem => ({
  id,
  label,
  href,
  active: false,
  openInNewTab: false,
  children: [],
  ...overrides,
});

const authenticatedUser: ShellViewUser = {
  kind: 'authenticated',
  name: 'June Han',
  email: 'june@example.com',
  imageUrls: { compact: null, mobile: null, detail: null },
};

const defaultProps: ShellViewProps = {
  loginHref: '/login?redirect=%2Fposts',
  navigationOpened: false,
  userMenuOpened: false,
  themeMode: 'light',
  user: null,
  headerItems: [
    navItem('home', 'Home', '/', { active: true }),
    navItem('explore', 'Explore', '/explore', {
      children: [navItem('artists', 'Artists', '/artists')],
    }),
  ],
  secondaryItems: [navItem('about', 'About', '/about')],
  footerItems: [navItem('privacy', 'Privacy', '/privacy')],
  accountItems: [navItem('profile', 'Profile', '/my/profile')],
  footer: {
    siteTitle: 'Example Studio',
    description: 'Independent publishing and spatial media.',
    copyright: '© 2026 Example Studio',
    taxId: '123-45-67890',
    companyAddress: 'Seoul',
    version: 'v0.21.3',
    showChangelog: false,
  },
  labels: {
    navigation: 'Example Studio navigation',
    toggleNavigation: 'Toggle navigation',
    close: 'Close',
    search: 'Search',
    searchTooltip: 'Search (Ctrl+K)',
    signIn: 'Sign in',
    account: 'Account',
    logOut: 'Log out',
    toggleColorScheme: 'Toggle color scheme',
    themeTooltip: 'Dark mode',
    cookieSettings: 'Cookie settings',
    changelog: 'Changelog',
    newsletter: 'Newsletter',
    footerSiteInfo: 'Site information',
    footerLinks: 'Links',
    footerSocialMedia: 'Social media',
  },
  events,
  slots: {
    logo: <span data-testid="logo">Example Studio</span>,
    printHeader: <span data-testid="print-header">Print header</span>,
    printWatermark: <span data-testid="print-watermark">Print watermark</span>,
    languageDesktop: <button type="button">Language desktop</button>,
    languageMobile: <button type="button">Language mobile</button>,
    languageFooterDesktop: (
      <TextButton size="xs" controlSize="xs" onClick={vi.fn()}>
        English desktop
      </TextButton>
    ),
    languageFooterMobile: (
      <TextButton size="xs" controlSize="xs" onClick={vi.fn()}>
        English mobile
      </TextButton>
    ),
    socialLinks: <a href="https://example.com/social">Social profile</a>,
  },
  linkComponent: TestLink,
  children: <main>Public page content</main>,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Object.values(events).forEach((event) => event.mockReset());
});

function renderView(overrides: Partial<ShellViewProps> = {}, children?: ReactNode) {
  act(() => {
    root.render(
      <TestProviders>
        <ShellView {...defaultProps} {...overrides}>
          {children ?? defaultProps.children}
        </ShellView>
      </TestProviders>,
    );
  });
}

describe('ShellView', () => {
  it('renders the public header, active navigation, print slots, page content, and semantic footer', () => {
    renderView();

    expect(container.querySelector('[data-shell]')?.getAttribute('data-user-state')).toBe('anonymous');
    expect(container.querySelector('a[aria-current="page"]')?.textContent).toBe('Home');
    expect(container.querySelector('nav[aria-label="Example Studio navigation"]')).not.toBeNull();
    expect(container.textContent).toContain('Public page content');
    expect(container.querySelector('[data-testid="print-header"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="print-watermark"]')).not.toBeNull();
    expect(container.querySelector('footer[data-shell-footer]')).not.toBeNull();
    expect(container.querySelector('footer a[href="/privacy"]')).not.toBeNull();
    expect(container.querySelectorAll('footer a[href="/login?intent=newsletter"]')).toHaveLength(2);
    expect(
      Array.from(container.querySelectorAll<HTMLButtonElement>('footer button')).some((button) =>
        button.textContent?.includes('Cookie settings'),
      ),
    ).toBe(true);
    const footerControls = Array.from(container.querySelectorAll<HTMLElement>('footer [data-control-size]'));
    expect(footerControls.length).toBeGreaterThan(0);
    expect(footerControls.every((control) => control.dataset.controlSize === 'xs')).toBe(true);
    expect(container.textContent).toContain('Independent publishing and spatial media.');
    expect(container.textContent).toContain('v0.21.3');
    expect(container.textContent).not.toContain('Changelog');
  });

  it('replaces a pending cookie snapshot with the anonymous header when session resolution loses the user', () => {
    renderView({
      user: {
        ...authenticatedUser,
        kind: 'snapshot',
        email: null,
      },
    });

    expect(container.querySelector('[data-shell]')?.getAttribute('data-user-state')).toBe('snapshot');
    expect(container.textContent).toContain('June Han');
    expect(container.querySelectorAll('[data-shell-login-action]')).toHaveLength(0);

    renderView({ user: null });

    expect(container.querySelector('[data-shell]')?.getAttribute('data-user-state')).toBe('anonymous');
    expect(container.textContent).not.toContain('June Han');
    expect(container.querySelectorAll('[data-shell-login-action]')).toHaveLength(2);
  });

  it('renders anonymous login actions as icon-free Core text buttons', () => {
    renderView();

    const loginActions = Array.from(container.querySelectorAll<HTMLAnchorElement>('[data-shell-login-action]'));

    expect(loginActions).toHaveLength(2);
    for (const [index, loginAction] of loginActions.entries()) {
      expect(loginAction.textContent?.trim()).toBe('Sign in');
      expect(loginAction.getAttribute('data-size')).toBe('xs');
      expect(loginAction.getAttribute('data-control-size')).toBe('sm');
      expect(loginAction.getAttribute('data-weight')).toBe('medium');
      expect(loginAction.getAttribute('data-shell-login-action')).toBe(index === 0 ? 'desktop' : 'mobile');
      expect(loginAction.className).toContain('loginAction');
      expect(loginAction.querySelector('svg')).toBeNull();
    }
  });

  it('forwards navigation, search, theme, cookie, and authenticated account events', () => {
    renderView({ user: authenticatedUser, userMenuOpened: true });

    const navigationToggle = container.querySelector<HTMLButtonElement>('button[aria-label="Toggle navigation"]');
    const searchButton = container.querySelector<HTMLButtonElement>('button[aria-label="Search"]');
    const themeButton = container.querySelector<HTMLButtonElement>('button[aria-label="Toggle color scheme"]');
    const cookieButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('Cookie settings'),
    );
    const profileLink = Array.from(document.querySelectorAll<HTMLAnchorElement>('a')).find(
      (link) => link.textContent === 'Profile',
    );
    const privacyLink = container.querySelector<HTMLAnchorElement>('footer a[href="/privacy"]');
    const newsletterLink = container.querySelector<HTMLAnchorElement>('footer a[href="/login?intent=newsletter"]');
    const signOutButton = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Log out',
    );

    act(() => {
      navigationToggle?.click();
      searchButton?.click();
      themeButton?.click();
      cookieButton?.click();
      profileLink?.click();
      privacyLink?.click();
      newsletterLink?.click();
      signOutButton?.click();
    });

    expect(events.onToggleNavigation).toHaveBeenCalledOnce();
    expect(events.onSearch).toHaveBeenCalledOnce();
    expect(events.onToggleColorScheme).toHaveBeenCalledOnce();
    expect(events.onOpenCookieSettings).toHaveBeenCalledOnce();
    expect(events.onNavigate).toHaveBeenCalledWith('/my/profile');
    expect(events.onNavigate).toHaveBeenCalledWith('/privacy');
    expect(events.onNavigate).toHaveBeenCalledWith('/login?intent=newsletter');
    expect(privacyLink?.hasAttribute('data-test-link-transport')).toBe(true);
    expect(events.onSignOut).toHaveBeenCalledOnce();
  });

  it('keeps both theme icons mounted so the prepaint root scheme selects one without a hydration swap', () => {
    renderView({ themeMode: null });

    const themeButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[aria-label="Toggle color scheme"]'),
    );
    const iconMarkup = themeButtons.map((button) => button.innerHTML);

    expect(themeButtons).toHaveLength(2);
    for (const themeButton of themeButtons) {
      expect(themeButton.querySelectorAll('[data-theme-icon-when="light"]')).toHaveLength(1);
      expect(themeButton.querySelectorAll('[data-theme-icon-when="dark"]')).toHaveLength(1);
    }

    renderView({ themeMode: 'dark' });

    const hydratedThemeButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[aria-label="Toggle color scheme"]'),
    );
    expect(hydratedThemeButtons.map((button) => button.innerHTML)).toEqual(iconMarkup);
  });

  it('uses Core menu and disclosure controls for accessible mobile navigation', () => {
    renderView();

    const navigationToggle = container.querySelector<HTMLButtonElement>('[data-menu-toggle]');
    const disclosure = container.querySelector<HTMLElement>('[data-shell-mobile-navigation] [data-disclosure]');
    const disclosureToggle = disclosure?.querySelector<HTMLButtonElement>('button[data-accordion-control]');

    expect(navigationToggle?.getAttribute('aria-label')).toBe('Toggle navigation');
    expect(navigationToggle?.getAttribute('aria-expanded')).toBe('false');
    expect(navigationToggle?.getAttribute('aria-controls')).toBe('shell-mobile-navigation');
    expect(disclosure?.getAttribute('data-appearance')).toBe('filled');
    expect(disclosure?.getAttribute('data-density')).toBe('compact');
    expect(disclosureToggle?.textContent).toBe('Explore');
    expect(disclosureToggle?.getAttribute('aria-expanded')).toBe('false');

    act(() => disclosureToggle?.click());

    expect(disclosureToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(disclosure?.textContent).toContain('Artists');
  });

  it('exposes navigation, account drawer, role-gated changelog, and theme state without owning them', () => {
    renderView({
      navigationOpened: true,
      userMenuOpened: true,
      themeMode: null,
      user: authenticatedUser,
      footer: { ...defaultProps.footer, showChangelog: true },
    });

    const shell = container.querySelector('[data-shell]');
    expect(shell?.getAttribute('data-navigation-opened')).toBe('true');
    expect(shell?.getAttribute('data-user-menu-opened')).toBe('true');
    expect(shell?.getAttribute('data-theme-mode')).toBe('pending');
    expect(container.querySelector('[data-shell-mobile-navigation]')).not.toBeNull();
    expect(document.body.textContent).toContain('Account');
    expect(container.querySelector('a[href="/changelog"]')).not.toBeNull();
    expect(container.querySelector('a[href="/changelog"]')?.hasAttribute('data-test-link-transport')).toBe(true);
  });
});
