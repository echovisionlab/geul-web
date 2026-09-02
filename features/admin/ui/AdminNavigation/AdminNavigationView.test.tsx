// @vitest-environment jsdom

import { act, forwardRef, type ComponentPropsWithoutRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { IconDashboard, IconSettings, IconUsers } from '@tabler/icons-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { AdminNavigationView, type AdminNavigationViewProps } from './AdminNavigationView';

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
  onToggleSection: vi.fn(),
  onToggleColorScheme: vi.fn(),
  onNavigate: vi.fn(),
};

const defaultProps: AdminNavigationViewProps = {
  sections: [
    {
      key: 'root',
      items: [{ href: '/admin', label: 'Dashboard', icon: IconDashboard, active: false }],
    },
    {
      key: 'system',
      title: 'System',
      icon: IconSettings,
      items: [
        { href: '/admin/users', label: 'Users', icon: IconUsers, active: true },
        { href: '/admin/settings', label: 'Settings', icon: IconSettings, active: false },
      ],
    },
  ],
  mode: 'expanded',
  openSectionKeys: ['system'],
  colorScheme: 'light',
  labels: {
    subtitle: 'Administration Panel',
    compactLabel: 'Admin',
    navigation: 'Administration',
    toggleColorScheme: 'Toggle color scheme',
    lightMode: 'Light mode',
    darkMode: 'Dark mode',
    backToSite: 'Back to site',
  },
  events,
  logoSlot: <span>Example Studio</span>,
  compactLogoSlot: <span>D</span>,
  linkComponent: TestLink,
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

function renderView(overrides: Partial<AdminNavigationViewProps> = {}) {
  act(() => {
    root.render(
      <TestProviders>
        <AdminNavigationView {...defaultProps} {...overrides} />
      </TestProviders>,
    );
  });
}

describe('AdminNavigationView', () => {
  it('composes branding, active navigation, theme action, and site return in expanded mode', () => {
    renderView();

    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Administration');
    expect(container.querySelector('a[aria-current="page"]')?.textContent).toContain('Users');
    expect(container.textContent).toContain('Administration Panel');
    expect(container.textContent).toContain('Back to site');

    const theme = container.querySelector<HTMLButtonElement>('button[aria-label="Toggle color scheme"]');
    const settings = container.querySelector<HTMLAnchorElement>('a[href="/admin/settings"]');
    const back = container.querySelector<HTMLAnchorElement>('a[href="/"]');

    expect(theme?.querySelector('svg')).toBeNull();
    expect(back?.querySelector('svg')).toBeNull();

    act(() => {
      theme?.click();
      settings?.click();
      back?.click();
    });

    expect(events.onToggleColorScheme).toHaveBeenCalledOnce();
    expect(events.onNavigate).toHaveBeenCalledWith('/admin/settings');
    expect(events.onNavigate).toHaveBeenCalledWith('/');
  });

  it('keeps every destination available in compact mode without exposing an expansion control on mobile', () => {
    renderView({ mode: 'compact', openSectionKeys: [] });

    const systemTrigger = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.getAttribute('aria-label') === 'System',
    );

    expect(container.querySelector('[data-admin-navigation]')?.getAttribute('data-mode')).toBe('compact');
    expect(container.querySelector('button[aria-label="Toggle navigation"]')).toBeNull();
    expect(container.querySelector('a[href="/admin/users"]')).toBeNull();
    expect(container.querySelector('a[href="/admin/settings"]')).toBeNull();
    expect(systemTrigger?.getAttribute('aria-haspopup')).toBe('menu');
    expect(systemTrigger?.getAttribute('data-active')).toBe('true');
    expect(container.querySelector('a[href="/admin"]')?.getAttribute('aria-label')).toBe('Admin');
    expect(container.querySelector('a[href="/"]')?.getAttribute('aria-label')).toBe('Back to site');
    expect(container.querySelector('button[aria-label="Toggle color scheme"] svg')).not.toBeNull();
    expect(container.querySelector('a[href="/"] svg')).not.toBeNull();
  });
});
