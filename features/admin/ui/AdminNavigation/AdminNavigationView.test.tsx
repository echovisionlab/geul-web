// @vitest-environment jsdom

import { mockBrowserNavigation } from '@/components/core/testing/browser-navigation';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { IconDashboard, IconSettings, IconUsers } from '@tabler/icons-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { AdminNavigationView, type AdminNavigationViewProps } from './AdminNavigationView';

const browserNavigation = mockBrowserNavigation();

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  browserNavigation.attach(container);
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
  it('keeps every destination available in compact mode without exposing an expansion control on mobile', () => {
    renderView({ mode: 'compact', openSectionKeys: [] });

    const systemTrigger = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.getAttribute('aria-label') === 'System',
    );

    expect(container.querySelector('[data-admin-navigation]')?.getAttribute('data-mode')).toBe('compact');
    expect(container.querySelector('button[aria-label="Toggle navigation"]')).toBeNull();
    expect(container.querySelector('a[href="/admin/users"]')).toBeNull();
    expect(container.querySelector('a[href="/admin/settings"]')).toBeNull();
    expect(['menu', 'true']).toContain(systemTrigger?.getAttribute('aria-haspopup'));
    expect(systemTrigger?.getAttribute('data-active')).toBe('true');
    expect(container.querySelector('a[href="/admin"]')?.getAttribute('aria-label')).toBe('Admin');
    expect(container.querySelector('a[href="/"]')?.getAttribute('aria-label')).toBe('Back to site');
    expect(container.querySelector('button[aria-label="Toggle color scheme"] svg')).not.toBeNull();
    expect(container.querySelector('a[href="/"] svg')).not.toBeNull();
  });
});
