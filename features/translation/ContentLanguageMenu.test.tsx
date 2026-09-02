// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import enMessages from '@/messages/en.json';
import { ContentLanguageMenu } from './ContentLanguageMenu';

vi.mock('@/components/core/DropdownMenu', async () => {
  const React = await import('react');

  const DropdownMenuContext = React.createContext<{
    opened: boolean;
    setOpened: React.Dispatch<React.SetStateAction<boolean>>;
  } | null>(null);

  function MockDropdownMenu({ children }: { children: ReactNode }) {
    const [opened, setOpened] = React.useState(false);
    return <DropdownMenuContext.Provider value={{ opened, setOpened }}>{children}</DropdownMenuContext.Provider>;
  }

  function MockDropdownMenuTarget({ children }: { children: ReactNode }) {
    const context = React.useContext(DropdownMenuContext);
    const child = children as React.ReactElement<{ onClick?: (event: MouseEvent) => void }>;

    return React.cloneElement(child, {
      onClick: (event: MouseEvent) => {
        child.props.onClick?.(event);
        context?.setOpened((opened) => !opened);
      },
    });
  }

  function MockDropdownMenuDropdown({ children }: { children: ReactNode }) {
    const context = React.useContext(DropdownMenuContext);
    if (!context?.opened) {
      return null;
    }
    return <div data-testid="menu-dropdown">{children}</div>;
  }

  function MockDropdownMenuItem({
    children,
    href,
    onClick,
  }: {
    children: ReactNode;
    href?: string;
    onClick?: () => void;
  }) {
    return href ? (
      <a href={href} role="menuitem">
        {children}
      </a>
    ) : (
      <button type="button" role="menuitem" onClick={onClick}>
        {children}
      </button>
    );
  }

  function MockDropdownMenuLabel({ children }: { children: ReactNode }) {
    return <div>{children}</div>;
  }

  function MockDropdownMenuDivider() {
    return <hr />;
  }

  return {
    DropdownMenu: Object.assign(MockDropdownMenu, {
      Target: MockDropdownMenuTarget,
      Dropdown: MockDropdownMenuDropdown,
      Item: MockDropdownMenuItem,
      Label: MockDropdownMenuLabel,
      Divider: MockDropdownMenuDivider,
    }),
  };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

function renderDropdownMenu(node: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MantineProvider>{node}</MantineProvider>
      </NextIntlClientProvider>,
    );
  });
}

async function flushUpdates() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function clickElement(element: Element | null | undefined) {
  expect(element).not.toBeNull();
  act(() => {
    element?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    element?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await flushUpdates();
}

describe('ContentLanguageMenu', () => {
  it('renders only available locales plus the source option when locale inventory is present', async () => {
    renderDropdownMenu(
      <ContentLanguageMenu
        pathname="/test"
        requestedLocale="en"
        localizationInfo={{
          displayedLocale: 'en',
          sourceLocale: 'ko',
          availableLocales: ['ko', 'en'],
        }}
      />,
    );

    await clickElement(document.querySelector('button'));

    expect(document.body.textContent).toContain('Source');
    expect(document.body.textContent).toContain('Original (한국어)');
    expect(document.body.textContent).toContain('View translation');
    expect(document.body.textContent).toContain('English');
    expect(document.body.textContent).not.toContain('日本語');
    expect(document.body.textContent).not.toContain('Français');
  });

  it('uses the displayed locale for the trigger when the requested locale is unavailable', () => {
    renderDropdownMenu(
      <ContentLanguageMenu
        pathname="/test"
        requestedLocale="ja"
        localizationInfo={{
          displayedLocale: 'ko',
          sourceLocale: 'ko',
          availableLocales: ['ko', 'en'],
        }}
      />,
    );

    expect(document.querySelector('button')?.textContent).toContain('한국어');
  });

  it('keeps the source option visible even when it is missing from available locales', async () => {
    renderDropdownMenu(
      <ContentLanguageMenu
        pathname="/test"
        requestedLocale="en"
        localizationInfo={{
          displayedLocale: 'en',
          sourceLocale: 'ko',
          availableLocales: ['en'],
        }}
      />,
    );

    await clickElement(document.querySelector('button'));

    expect(document.body.textContent).toContain('Original (한국어)');
    expect(document.body.textContent).toContain('English');
    expect(document.body.textContent).not.toContain('日本語');
  });

  it('falls back to the full supported locale list when no inventory is provided', async () => {
    renderDropdownMenu(
      <ContentLanguageMenu
        pathname="/test"
        requestedLocale="en"
        localizationInfo={{
          displayedLocale: 'en',
          sourceLocale: 'ko',
        }}
      />,
    );

    await clickElement(document.querySelector('button'));

    expect(document.body.textContent).toContain('Original (한국어)');
    expect(document.body.textContent).toContain('English');
    expect(document.body.textContent).toContain('日本語');
    expect(document.body.textContent).toContain('Français');
  });

  it('uses an in-place locale callback instead of a navigation href when provided', async () => {
    const onRequestedLocaleChange = vi.fn();
    renderDropdownMenu(
      <ContentLanguageMenu
        pathname="/posts/shared-post"
        query={{ share: 'share-token' }}
        requestedLocale="en"
        localizationInfo={{
          displayedLocale: 'en',
          sourceLocale: 'ko',
          availableLocales: ['ko', 'en'],
        }}
        onRequestedLocaleChange={onRequestedLocaleChange}
      />,
    );

    await clickElement(document.querySelector('button'));
    const sourceItem = Array.from(document.querySelectorAll('[role="menuitem"]')).find((element) =>
      element.textContent?.includes('Original'),
    );
    expect(sourceItem?.tagName).toBe('BUTTON');

    await clickElement(sourceItem);

    expect(onRequestedLocaleChange).toHaveBeenCalledWith('ko');
    expect(sourceItem?.getAttribute('href')).toBeNull();
  });
});
