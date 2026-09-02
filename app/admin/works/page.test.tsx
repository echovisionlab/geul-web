// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import AdminWorksPage from './page';

const pushMock = vi.fn();
const createWorkActionMock = vi.fn();
const deleteWorkActionMock = vi.fn();
const listWorksAdminActionMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const translate = (key: string, values?: Record<string, unknown>) => {
      if (key === 'actions.newItem') {
        return `New ${String(values?.item ?? 'item')}`;
      }
      if (key === 'actions.searchItems') {
        return `Search ${String(values?.items ?? 'items')}`;
      }
      return `${namespace}.${key}`;
    };
    return Object.assign(translate, { rich: translate });
  },
}));

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

vi.mock('@/features/admin/ui/AdminPageHeader', () => ({
  AdminPageHeader: (props: {
    title: string;
    items?: Array<{
      key: string;
      label: string;
      onClick?: () => void;
      disabled?: boolean;
    }>;
  }) => (
    <header>
      <h1>{props.title}</h1>
      {props.items?.map((item) => (
        <button key={item.key} type="button" data-testid={item.key} disabled={item.disabled} onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </header>
  ),
}));

vi.mock('@/features/data-table/DataTableSelectableSection', () => ({
  DataTableSelectableSection: () => <div data-testid="works-table" />,
}));

vi.mock('@/components/core/DataTable', () => ({
  TableRowMenu: () => <button type="button">Row menu</button>,
}));

vi.mock('@/components/core/Button', () => ({
  Button: ({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick?: () => void }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/core/Badge', () => ({
  badgeToneFromColor: () => 'neutral',
  LabelBadge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  statusToneFromColor: () => 'neutral',
  StatusBadge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/lib/i18n/admin-labels', () => ({
  normalizeEnumToken: (value: string) => value,
  translateCommonStatus: (value: string) => value,
}));

vi.mock('@/lib/providers/LocaleProvider', () => ({
  useLocale: () => 'en',
}));

vi.mock('@/lib/actions/work', () => ({
  createWorkAction: (...args: unknown[]) => createWorkActionMock(...args),
  deleteWorkAction: (...args: unknown[]) => deleteWorkActionMock(...args),
  listWorksAdminAction: (...args: unknown[]) => listWorksAdminActionMock(...args),
}));

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let queryClient: QueryClient | null = null;

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

function render() {
  queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <MantineProvider>
          <AdminWorksPage />
        </MantineProvider>
      </QueryClientProvider>,
    );
  });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  pushMock.mockReset();
  createWorkActionMock.mockReset();
  deleteWorkActionMock.mockReset();
  listWorksAdminActionMock.mockReset();
  listWorksAdminActionMock.mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
  });
  createWorkActionMock.mockResolvedValue({
    data: { id: 'new-work-id' },
  });
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  queryClient?.clear();
  queryClient = null;
});

describe('AdminWorksPage', () => {
  it('invalidates the work list cache before navigating to a newly created work', async () => {
    render();
    await flush();

    const invalidateQueries = vi.spyOn(queryClient!, 'invalidateQueries');
    const createButton = document.querySelector<HTMLButtonElement>('[data-testid="create-work"]');
    expect(createButton).not.toBeNull();

    await act(async () => {
      createButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(createWorkActionMock).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['works'] });
    expect(pushMock).toHaveBeenCalledWith('/works/new-work-id?edit=true');
  });
});
