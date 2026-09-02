// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { AdminPageHeader } from './AdminPageHeader';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
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

async function flushUpdates() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function clickElement(element: Element | null | undefined) {
  expect(element).not.toBeNull();
  expect(element).not.toBeUndefined();

  act(() => {
    element?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    element?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });

  await flushUpdates();
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe('AdminPageHeader', () => {
  it('renders action, href, and custom items together', async () => {
    const onCreate = vi.fn();

    render(
      <AdminPageHeader
        title="Posts"
        description="Manage published and draft posts."
        items={[
          {
            key: 'new',
            type: 'action',
            label: 'New post',
            onClick: onCreate,
          },
          {
            key: 'guidelines',
            type: 'action',
            label: 'Guidelines',
            href: '/admin/docs/guidelines',
          },
          {
            key: 'custom',
            type: 'custom',
            content: <button type="button">Bulk actions</button>,
          },
        ]}
      />,
    );

    expect(document.querySelector('h2')?.textContent).toBe('Posts');
    expect(document.body.textContent).toContain('Manage published and draft posts.');
    expect(document.body.textContent).toContain('New post');
    expect(document.body.textContent).toContain('Guidelines');
    expect(document.body.textContent).toContain('Bulk actions');
    expect(document.querySelector('a[href="/admin/docs/guidelines"]')?.textContent).toBe('Guidelines');

    await clickElement(
      Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('New post')),
    );

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('renders cleanly without action items', () => {
    render(<AdminPageHeader title="Forms" description="Shared form definitions" />);

    expect(document.querySelector('h2')?.textContent).toBe('Forms');
    expect(document.body.textContent).toContain('Shared form definitions');
    expect(document.querySelectorAll('button').length).toBe(0);
    expect(document.querySelectorAll('a').length).toBe(0);
  });
});
