// @vitest-environment jsdom

import { act, forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { IconDashboard, IconSettings, IconUsers } from '@tabler/icons-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminShellView, type AdminShellViewProps } from '@/features/admin/ui/AdminShell';
import { TestProviders } from '@/test/TestProviders';
import { isAdminNavItemActive } from './AdminShell';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TestLink = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<'a'>>(({ href, onClick, ...props }, ref) => (
  <a
    ref={ref}
    {...props}
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
  onToggleSection: vi.fn(),
  onToggleColorScheme: vi.fn(),
  onNavigate: vi.fn(),
};

const defaultProps: AdminShellViewProps = {
  navSections: [
    {
      key: 'root',
      items: [
        {
          href: '/admin',
          label: 'Dashboard',
          icon: IconDashboard,
          active: false,
        },
      ],
    },
    {
      key: 'system',
      title: 'System',
      items: [
        {
          href: '/admin/users',
          label: 'Users',
          icon: IconUsers,
          active: true,
        },
        {
          href: '/admin/settings',
          label: 'Settings',
          icon: IconSettings,
          active: false,
        },
      ],
    },
  ],
  navigationMode: 'expanded',
  navigationToggleVisible: true,
  openSectionKeys: ['system'],
  colorScheme: 'light',
  labels: {
    subtitle: 'Administration Panel',
    compactLabel: 'Admin',
    navigation: 'Administration',
    toggleNavigation: 'Toggle navigation',
    toggleColorScheme: 'Toggle color scheme',
    lightMode: 'Light mode',
    darkMode: 'Dark mode',
    backToSite: 'Back to site',
  },
  events,
  logoSlot: <span>Example Studio</span>,
  compactLogoSlot: <span>D</span>,
  linkComponent: TestLink,
  children: <main>User administration</main>,
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

function renderView(overrides: Partial<AdminShellViewProps> = {}, children?: ReactNode) {
  act(() => {
    root.render(
      <TestProviders>
        <AdminShellView {...defaultProps} {...overrides}>
          {children ?? defaultProps.children}
        </AdminShellView>
      </TestProviders>,
    );
  });
}

describe('AdminShell route matching', () => {
  it('keeps exact parents inactive while matching nested section routes by prefix', () => {
    expect(isAdminNavItemActive('/admin', { href: '/admin', exact: true })).toBe(true);
    expect(isAdminNavItemActive('/admin/users/42', { href: '/admin/users' })).toBe(true);
    expect(
      isAdminNavItemActive('/admin/settings/mail', {
        href: '/admin/settings',
        exact: true,
      }),
    ).toBe(false);
    expect(isAdminNavItemActive('/admin/users-archive', { href: '/admin/users' })).toBe(false);
  });
});

describe('AdminShellView', () => {
  it('renders display-ready navigation, active state, branding, and page content', () => {
    renderView();

    expect(container.querySelector('[data-admin-shell]')?.getAttribute('data-navigation-mode')).toBe('expanded');
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Administration');
    expect(container.querySelector('a[aria-current="page"]')?.textContent).toContain('Users');
    expect(container.querySelector('[data-section-key="system"] button')?.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('Administration Panel');
    expect(container.textContent).toContain('User administration');
    expect(container.querySelector('[data-admin-navigation-edge-toggle]')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('forwards section, navigation, route, and theme interactions through events', () => {
    renderView();

    const sectionButton = container.querySelector<HTMLButtonElement>('[data-section-key="system"] button');
    const navigationButton = container.querySelector<HTMLButtonElement>('[data-admin-navigation-edge-toggle]');
    const themeButton = container.querySelector<HTMLButtonElement>('button[aria-label="Toggle color scheme"]');
    const settingsLink = Array.from(container.querySelectorAll<HTMLAnchorElement>('a')).find((link) =>
      link.textContent?.includes('Settings'),
    );

    act(() => {
      sectionButton?.click();
      navigationButton?.click();
      themeButton?.click();
      settingsLink?.click();
    });

    expect(events.onToggleSection).toHaveBeenCalledWith('system');
    expect(events.onToggleNavigation).toHaveBeenCalledOnce();
    expect(events.onToggleColorScheme).toHaveBeenCalledOnce();
    expect(events.onNavigate).toHaveBeenCalledWith('/admin/settings');
  });

  it('keeps closed section content associated with its disclosure control', () => {
    renderView({ openSectionKeys: [] });

    const sectionButton = container.querySelector<HTMLButtonElement>('[data-section-key="system"] button');
    const contentId = sectionButton?.getAttribute('aria-controls');
    const sectionContent = contentId ? container.querySelector<HTMLElement>(`#${contentId}`) : null;

    expect(sectionButton?.getAttribute('aria-expanded')).toBe('false');
    expect(sectionContent?.hidden).toBe(true);
  });

  it('exposes pending theme state without guessing the rendered color scheme', () => {
    renderView({ colorScheme: null });

    expect(container.querySelector('[data-admin-shell]')?.getAttribute('data-theme-mode')).toBe('pending');
    expect(container.querySelector('button[aria-label="Toggle color scheme"]')?.getAttribute('data-tone')).toBe(
      'neutral',
    );
  });

  it('omits the edge toggle when the responsive controller marks it unavailable', () => {
    renderView({ navigationMode: 'compact', navigationToggleVisible: false });

    expect(container.querySelector('[data-admin-navigation-edge-toggle]')).toBeNull();
  });
});
