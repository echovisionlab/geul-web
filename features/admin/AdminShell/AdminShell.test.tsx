// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminShellViewProps } from '@/features/admin/ui/AdminShell';

const mocks = vi.hoisted(() => ({
  isDesktop: true,
  pathname: '/admin/posts',
  toggleColorScheme: vi.fn(),
  viewProps: null as AdminShellViewProps | null,
}));

vi.mock('next-intl', () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock('@mantine/core', () => ({
  useComputedColorScheme: () => 'light',
  useMantineColorScheme: () => ({ toggleColorScheme: mocks.toggleColorScheme }),
}));

vi.mock('@mantine/hooks', () => ({
  useMediaQuery: () => mocks.isDesktop,
  useMounted: () => true,
}));

vi.mock('@/features/site/SiteLogo', () => ({
  SiteLogo: () => null,
}));

vi.mock('@/features/admin/ui/AdminShell', () => ({
  AdminShellView: (props: AdminShellViewProps) => {
    mocks.viewProps = props;
    return props.children;
  },
}));

import { AdminShell } from './AdminShell';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.isDesktop = true;
  mocks.pathname = '/admin/posts';
  mocks.viewProps = null;
  mocks.toggleColorScheme.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderController(children: ReactNode = <main>Admin content</main>) {
  act(() => {
    root.render(<AdminShell>{children}</AdminShell>);
  });
}

function viewProps() {
  expect(mocks.viewProps).not.toBeNull();
  return mocks.viewProps!;
}

describe('AdminShell controller', () => {
  it('exposes the full file manager as an active static Site Admin menu item', () => {
    mocks.pathname = '/admin/files';
    renderController();

    const fileManagerItem = viewProps()
      .navSections.flatMap((section) => section.items)
      .find((item) => item.href === '/admin/files');

    expect(fileManagerItem).toMatchObject({
      href: '/admin/files',
      label: 'title',
      active: true,
    });
  });

  it('does not prefetch the server-rendered Member administration response', () => {
    renderController();

    const memberAdministration = viewProps()
      .navSections.flatMap((section) => section.items)
      .find((item) => item.href === '/admin/users');

    expect(memberAdministration?.prefetch).toBe(false);
  });

  it('preserves the desktop expansion preference across breakpoints and ignores mobile toggles', () => {
    renderController();
    expect(viewProps()).toMatchObject({
      navigationMode: 'expanded',
      navigationToggleVisible: true,
    });

    mocks.isDesktop = false;
    renderController();
    expect(viewProps()).toMatchObject({
      navigationMode: 'compact',
      navigationToggleVisible: false,
    });

    act(() => viewProps().events.onToggleNavigation());
    mocks.isDesktop = true;
    renderController();
    expect(viewProps().navigationMode).toBe('expanded');

    act(() => viewProps().events.onToggleNavigation());
    expect(viewProps().navigationMode).toBe('compact');

    mocks.isDesktop = false;
    renderController();
    mocks.isDesktop = true;
    renderController();
    expect(viewProps().navigationMode).toBe('compact');
  });
});
