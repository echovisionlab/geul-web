// @vitest-environment jsdom

import { act, forwardRef, type ComponentPropsWithoutRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { SideNavigation, type SideNavigationProps, type SideNavigationSection } from './SideNavigation';

type TestLinkProps = ComponentPropsWithoutRef<'a'> & { prefetch?: boolean };

const TestLink = forwardRef<HTMLAnchorElement, TestLinkProps>(({ href, onClick, prefetch, ...props }, ref) => (
  <a
    ref={ref}
    {...props}
    href={href}
    data-test-link
    data-prefetch={prefetch === false ? 'false' : undefined}
    onClick={(event) => {
      event.preventDefault();
      onClick?.(event);
    }}
  />
));
TestLink.displayName = 'TestLink';

const sections: readonly SideNavigationSection[] = [
  {
    key: 'root',
    items: [
      {
        key: 'dashboard',
        href: '/dashboard',
        label: 'Dashboard',
        icon: <svg data-icon="dashboard" />,
        active: true,
      },
    ],
  },
  {
    key: 'workspace',
    label: 'Workspace',
    icon: <svg data-icon="workspace" />,
    items: [
      {
        key: 'activity',
        href: '/activity',
        label: 'Activity',
        icon: <svg data-icon="activity" />,
        prefetch: false,
      },
    ],
  },
  {
    key: 'account',
    label: 'Account',
    icon: <svg data-icon="account" />,
    items: [
      {
        key: 'profile',
        href: '/account/profile',
        label: 'Profile',
        icon: <svg data-icon="profile" />,
      },
    ],
  },
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function renderNavigation(overrides: Partial<SideNavigationProps> = {}) {
  const props: SideNavigationProps = {
    ariaLabel: 'Primary navigation',
    sections,
    mode: 'expanded',
    openSectionKeys: ['workspace', 'account'],
    linkComponent: TestLink,
    onToggleSection: vi.fn(),
    onSelectItem: vi.fn(),
    ...overrides,
  };

  act(() => {
    root.render(
      <MantineProvider env="test">
        <SideNavigation {...props} />
      </MantineProvider>,
    );
  });

  return props;
}

function getSectionButton(label: string) {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent === label,
  );

  if (!button) {
    throw new Error(`Expected a section button named ${label}.`);
  }

  return button;
}

function getItemLink(key: string) {
  const link = document.querySelector<HTMLAnchorElement>(`[data-item-key="${key}"]`);
  if (!link) {
    throw new Error(`Expected a navigation item with key ${key}.`);
  }
  return link;
}

describe('SideNavigation', () => {
  it('exposes expanded sections as controlled disclosures', () => {
    const onToggleSection = vi.fn();
    renderNavigation({ openSectionKeys: ['workspace'], onToggleSection });

    const navigation = container.querySelector<HTMLElement>('nav');
    const workspaceButton = getSectionButton('Workspace');
    const accountButton = getSectionButton('Account');
    const rootSection = container.querySelector<HTMLElement>('[data-section-key="root"]');
    const rootContent = container.querySelector<HTMLElement>('[data-section-items="root"]');
    const workspaceContent = document.getElementById(workspaceButton.getAttribute('aria-controls') ?? '');
    const accountContent = document.getElementById(accountButton.getAttribute('aria-controls') ?? '');

    expect(navigation?.getAttribute('aria-label')).toBe('Primary navigation');
    expect(rootSection?.hasAttribute('aria-label')).toBe(false);
    expect(rootSection?.hasAttribute('aria-labelledby')).toBe(false);
    expect(rootContent?.hidden).toBe(false);
    expect(workspaceButton.getAttribute('aria-expanded')).toBe('true');
    expect(workspaceContent?.hidden).toBe(false);
    expect(accountButton.getAttribute('aria-expanded')).toBe('false');
    expect(accountContent?.hidden).toBe(true);

    act(() => accountButton.click());

    expect(onToggleSection).toHaveBeenCalledOnce();
    expect(onToggleSection).toHaveBeenCalledWith('account');
    expect(accountButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('groups labeled sections behind compact menu triggers while keeping root destinations direct', () => {
    const onSelectItem = vi.fn();
    renderNavigation({ mode: 'compact', openSectionKeys: [], onSelectItem });

    const navigation = container.querySelector<HTMLElement>('nav');
    const sectionContents = container.querySelectorAll<HTMLElement>('[data-section-items]');
    const workspaceButton = getSectionButton('Workspace');
    const accountButton = getSectionButton('Account');

    expect(navigation?.getAttribute('data-mode')).toBe('compact');
    expect(Array.from(sectionContents).every((content) => !content.hidden)).toBe(true);
    expect(container.querySelectorAll<HTMLAnchorElement>('[data-test-link]')).toHaveLength(1);
    expect(workspaceButton.getAttribute('aria-haspopup')).toBe('menu');
    expect(accountButton.getAttribute('aria-haspopup')).toBe('menu');
    expect(container.querySelector('[data-section-key="root"]')?.hasAttribute('aria-label')).toBe(false);
    expect(getItemLink('dashboard').getAttribute('aria-label')).toBe('Dashboard');

    act(() => accountButton.click());

    const profileLink = getItemLink('profile');
    expect(accountButton.getAttribute('aria-expanded')).toBe('true');
    expect(profileLink.getAttribute('role')).toBe('menuitem');
    expect(profileLink.getAttribute('href')).toBe('/account/profile');

    act(() => profileLink.click());
    expect(onSelectItem).toHaveBeenCalledWith(sections[2].items[0]);
  });

  it('forwards an explicit no-prefetch boundary to sensitive destinations', () => {
    renderNavigation();

    expect(getItemLink('activity').getAttribute('data-prefetch')).toBe('false');
    expect(getItemLink('dashboard').hasAttribute('data-prefetch')).toBe(false);
  });

  it('marks only active items as the current page', () => {
    renderNavigation();

    expect(getItemLink('dashboard').getAttribute('aria-current')).toBe('page');
    expect(getItemLink('activity').hasAttribute('aria-current')).toBe(false);
    expect(getItemLink('dashboard').hasAttribute('data-active')).toBe(true);
  });

  it('renders the generic link component and emits item selection through its callback', () => {
    const onSelectItem = vi.fn();
    renderNavigation({ onSelectItem });

    const profileLink = getItemLink('profile');
    expect(profileLink.getAttribute('href')).toBe('/account/profile');
    expect(profileLink.hasAttribute('data-test-link')).toBe(true);

    act(() => profileLink.click());

    expect(onSelectItem).toHaveBeenCalledOnce();
    expect(onSelectItem).toHaveBeenCalledWith(sections[2].items[0]);
  });

  it('keeps item icons decorative while preserving the visible expanded label', () => {
    renderNavigation();

    const dashboardLink = getItemLink('dashboard');
    const iconContainer = dashboardLink.querySelector<HTMLElement>('[aria-hidden="true"]');

    expect(iconContainer).not.toBeNull();
    expect(dashboardLink.textContent).toBe('Dashboard');
    expect(dashboardLink.hasAttribute('aria-label')).toBe(false);
  });

  it('allows feature compositions to hide icons only in expanded mode', () => {
    renderNavigation({ showExpandedIcons: false });

    expect(container.querySelector('nav')?.getAttribute('data-expanded-icons')).toBe('hidden');
    expect(getItemLink('dashboard').querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
