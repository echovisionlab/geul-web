// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { IconSettings, IconUser } from '@tabler/icons-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { UserShellView, type UserShellViewProps } from './UserShellView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const onTabChange = vi.fn();
let container: HTMLDivElement;
let root: Root;

const defaultProps: UserShellViewProps = {
  user: {
    name: 'June Han',
    roleLabel: 'Author',
    roleTone: 'accent',
    navigationLabel: 'Account menu',
  },
  tabs: [
    { value: 'profile', label: 'Profile', icon: IconUser },
    { value: 'settings', label: 'Settings', icon: IconSettings },
  ],
  currentTab: 'profile',
  events: { onTabChange },
  avatarSlot: <div data-testid="avatar-slot">Avatar</div>,
  children: <main>Profile content</main>,
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  onTabChange.mockReset();
});

function renderView(overrides: Partial<UserShellViewProps> = {}, children?: ReactNode) {
  act(() => {
    root.render(
      <TestProviders>
        <UserShellView {...defaultProps} {...overrides}>
          {children ?? defaultProps.children}
        </UserShellView>
      </TestProviders>,
    );
  });
}

describe('UserShellView', () => {
  it('renders display-ready user, tab, avatar, and page content props', () => {
    renderView();

    expect(container.textContent).toContain('June Han');
    expect(container.textContent).toContain('Author');
    expect(container.querySelector('[data-tone="accent"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="avatar-slot"]')).not.toBeNull();
    expect(container.textContent).toContain('Profile content');
    expect(container.querySelectorAll('[data-user-shell-tab]')).toHaveLength(2);
    expect(container.querySelector('[data-user-shell-tab][aria-selected="true"]')?.textContent).toContain('Profile');
    expect(container.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Account menu');
  });

  it('forwards tab changes through the events prop', () => {
    renderView();

    const settingsTab = container.querySelector<HTMLButtonElement>('[data-user-shell-tab="settings"]');
    expect(settingsTab).toBeDefined();

    act(() => settingsTab?.click());

    expect(onTabChange).toHaveBeenCalledWith('settings');
  });

  it('supports arrow-key navigation across the Core tab buttons', () => {
    renderView();

    const profileTab = container.querySelector<HTMLButtonElement>('[data-user-shell-tab="profile"]');
    const settingsTab = container.querySelector<HTMLButtonElement>('[data-user-shell-tab="settings"]');

    // Arrow keys move within a tab list that already holds keyboard focus.
    act(() => profileTab?.focus());
    expect(document.activeElement).toBe(profileTab);
    act(() => {
      profileTab?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    expect(onTabChange).toHaveBeenCalledWith('settings');
    expect(document.activeElement).toBe(settingsTab);
  });

  it('keeps the tab list wrapping within the shell width', () => {
    renderView();

    // Core Tabs owns the wrapping geometry (bounded list width, non-shrinking tabs) behind `wrap`.
    const tabList = container.querySelector<HTMLElement>('[data-user-shell-tab-list]');
    expect(tabList?.getAttribute('role')).toBe('tablist');
    expect(tabList?.getAttribute('data-wrap')).toBe('wrap');
    expect(tabList?.hasAttribute('style')).toBe(false);
    for (const tab of container.querySelectorAll<HTMLElement>('[data-user-shell-tab]')) {
      expect(tab.getAttribute('role')).toBe('tab');
      expect(tab.hasAttribute('style')).toBe(false);
    }
  });
});
