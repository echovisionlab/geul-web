// @vitest-environment jsdom

import { act, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { UserInlineLinks } from './UserInlineLinks';

vi.mock('next/link', () => ({
  default: ({ href, children, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </a>
  ),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<MantineProvider>{node}</MantineProvider>);
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe('UserInlineLinks', () => {
  it('renders comma-separated text-only links when requested', () => {
    render(
      <UserInlineLinks
        users={[
          { id: 'user-1', name: 'Writer One' },
          { id: 'user-2', name: 'Writer Two' },
        ]}
        unknownLabel="Unknown"
        showAvatars={false}
        separator="comma"
      />,
    );

    expect(document.body.textContent).toContain('Writer One, Writer Two');
  });

  it('renders slash separators between user groups when requested', () => {
    render(
      <UserInlineLinks
        users={[
          { id: 'user-1', name: 'Writer One' },
          { id: 'user-2', name: 'Writer Two' },
        ]}
        unknownLabel="Unknown"
        separator="slash"
        showAvatars={false}
      />,
    );

    expect(document.body.textContent).toContain('Writer One/Writer Two');
  });

  it('limits visible users and shows an overflow label', () => {
    render(
      <UserInlineLinks
        users={[
          { id: 'user-1', name: 'Writer One' },
          { id: 'user-2', name: 'Writer Two' },
          { id: 'user-3', name: 'Writer Three' },
        ]}
        unknownLabel="Unknown"
        maxVisibleUsers={2}
      />,
    );

    expect(document.querySelectorAll('a[href^="/user/"]')).toHaveLength(2);
    expect(document.body.textContent).toContain('Writer One');
    expect(document.body.textContent).toContain('Writer Two');
    expect(document.body.textContent).not.toContain('Writer Three');
    expect(document.body.textContent).toContain('+1');
  });
});
