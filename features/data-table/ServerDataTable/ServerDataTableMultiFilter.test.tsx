// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { ServerDataTableMultiFilter } from './ServerDataTableMultiFilter';

const pushMock = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => '/test',
  useSearchParams: () => currentSearchParams,
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const messages: Record<string, string> = {
      'dataTable.filter.button': 'Filter',
      'dataTable.filter.drawerTitle': 'Filters',
      'dataTable.filter.selectField': 'Select field',
      'dataTable.filter.activeFilters': 'Active filters',
      'dataTable.filter.operator': 'Operator',
      'dataTable.filter.value': 'Value',
      'dataTable.filter.enterValue': 'Enter value',
      'dataTable.filter.operators.eq': 'Equals',
      'dataTable.filter.operators.isNull': 'Is null',
      'common.actions.apply': 'Apply',
      'common.actions.close': 'Close',
      'common.actions.clearAll': 'Clear all',
      'common.labels.fields': 'Fields',
      'common.labels.value': 'Value',
      'common.placeholders.selectValues': 'Select values',
    };

    return messages[`${namespace}.${key}`] ?? key;
  },
}));

vi.mock('@/components/core/Tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/core/Drawer', () => ({
  Drawer: ({
    opened,
    onClose,
    title,
    closeLabel,
    children,
  }: {
    opened: boolean;
    onClose: () => void;
    title: ReactNode;
    closeLabel: string;
    children?: ReactNode;
  }) =>
    opened ? (
      <div role="dialog">
        <div>{title}</div>
        <button type="button" aria-label={closeLabel} onClick={onClose} />
        {children}
      </div>
    ) : null,
}));

vi.mock('@mantine/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mantine/core')>();

  return {
    ...actual,
    Indicator: ({ children }: { children: ReactNode }) => <>{children}</>,
    ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Popover: Object.assign(({ children }: { children?: ReactNode }) => <div>{children}</div>, {
      Target: ({ children }: { children?: ReactNode }) => <>{children}</>,
      Dropdown: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    }),
  };
});

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

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

function findButtonByLabel(label: string) {
  return Array.from(document.querySelectorAll('button')).find(
    (button) => button.getAttribute('aria-label') === label,
  ) as HTMLButtonElement | undefined;
}

function findButtonByText(text: string) {
  return Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.trim() === text) as
    HTMLButtonElement | undefined;
}

beforeEach(() => {
  pushMock.mockReset();
  currentSearchParams = new URLSearchParams();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe('ServerDataTableMultiFilter', () => {
  it('keeps draft filter edits local until Apply is clicked', async () => {
    currentSearchParams = new URLSearchParams();
    currentSearchParams.set(
      'posts',
      JSON.stringify({
        filters: [{ field: 'title', op: 'eq', value: 'space' }],
        filterBy: 'AND',
      }),
    );

    render(
      <ServerDataTableMultiFilter namespace="posts" fields={[{ field: 'title', label: 'Title', type: 'string' }]} />,
    );

    const trigger = findButtonByLabel('Filter');
    expect(trigger).toBeDefined();

    act(() => {
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await flush();

    const clearAllButton = findButtonByText('Clear all');
    expect(clearAllButton).toBeDefined();

    act(() => {
      clearAllButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(pushMock).not.toHaveBeenCalled();

    const applyButton = findButtonByText('Apply');
    expect(applyButton).toBeDefined();

    act(() => {
      applyButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(decodeURIComponent(String(pushMock.mock.calls[0]?.[0]))).not.toContain('"filters"');
  });
});
