// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import AdminEmailLayoutsPage from '@/app/admin/email-layouts/page';
import AdminEmailTemplatesPage from '@/app/admin/email-templates/page';

const api = vi.hoisted(() => ({
  createEmailLayoutAction: vi.fn(),
  createEmailTemplateAction: vi.fn(),
  deleteEmailLayoutAction: vi.fn(),
  deleteEmailTemplateAction: vi.fn(),
  listEmailEventMappingsAction: vi.fn(),
  listEmailLayouts: vi.fn(),
  listEmailTemplatesAdminAction: vi.fn(),
  previewEmailLayout: vi.fn(),
  updateEmailTemplateEventMappingAction: vi.fn(),
}));

const notificationMocks = vi.hoisted(() => ({ show: vi.fn() }));
const pushMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace: string) => {
    const translate = (key: string, values?: Record<string, unknown>) => {
      if (values?.name) {
        return `${namespace}.${key}:${String(values.name)}`;
      }
      return `${namespace}.${key}`;
    };
    return Object.assign(translate, { rich: translate });
  },
}));

vi.mock('@mantine/notifications', () => ({ notifications: notificationMocks }));

vi.mock('@/features/admin/ui/AdminPageHeader', () => ({
  AdminPageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('@/features/data-table/DataTableSelectableSection', () => ({
  DataTableSelectableSection: ({
    columns,
    result,
  }: {
    columns: Array<{ key: string; cell: (row: Record<string, unknown>) => ReactNode }>;
    result?: { data: Array<Record<string, unknown>> };
  }) => (
    <div data-testid="email-authoring-table">
      {result?.data.map((row) => (
        <section key={String(row.id)}>
          {columns.map((column) => (
            <div key={column.key}>{column.cell(row)}</div>
          ))}
        </section>
      ))}
    </div>
  ),
}));

vi.mock('@/components/core/DataTable', () => ({
  TableRowMenu: ({ items }: { items: Array<{ label: string; onClick: () => void }> }) => (
    <div>
      {items.map((item) => (
        <button key={item.label} type="button" onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('@/components/core/Modal', () => ({
  ConfirmModal: ({
    opened,
    title,
    message,
    confirmLabel,
    onConfirm,
  }: {
    opened: boolean;
    title: string;
    message: ReactNode;
    confirmLabel: string;
    onConfirm: () => void;
  }) =>
    opened ? (
      <section role="dialog" aria-label={title}>
        <div>{message}</div>
        <button data-testid="confirm-delete" type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </section>
    ) : null,
  ContentModal: () => null,
  FormModal: () => null,
}));

vi.mock('@/components/core/Input', () => ({
  Select: ({ value, placeholder }: { value?: string | null; placeholder?: string }) => (
    <span>{value || placeholder}</span>
  ),
  Textarea: () => null,
  TextInput: () => null,
}));

vi.mock('@/components/core/TextButton', () => ({
  TextButton: ({ children, href }: { children: ReactNode; href?: string }) => <a href={href}>{children}</a>,
}));

vi.mock('@/components/core/Badge', () => ({
  LabelBadge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  StatusBadge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/lib/actions/email-template', () => ({
  createEmailTemplateAction: api.createEmailTemplateAction,
  deleteEmailTemplateAction: api.deleteEmailTemplateAction,
  listEmailEventMappingsAction: api.listEmailEventMappingsAction,
  listEmailTemplatesAdminAction: api.listEmailTemplatesAdminAction,
  updateEmailTemplateEventMappingAction: api.updateEmailTemplateEventMappingAction,
}));

vi.mock('@/lib/actions/email-layout', () => ({
  createEmailLayoutAction: api.createEmailLayoutAction,
  deleteEmailLayoutAction: api.deleteEmailLayoutAction,
}));

vi.mock('@/lib/queries/email-layout', () => ({
  listEmailLayouts: api.listEmailLayouts,
  previewEmailLayout: api.previewEmailLayout,
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

function renderPage(node: ReactNode) {
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
        <MantineProvider>{node}</MantineProvider>
      </QueryClientProvider>,
    );
  });
}

async function flush() {
  await act(async () => {
    for (let pass = 0; pass < 5; pass += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

function clickButton(label: string) {
  const button = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent === label);
  expect(button).toBeDefined();
  act(() => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function confirmDelete() {
  const button = document.querySelector<HTMLButtonElement>('[data-testid="confirm-delete"]');
  expect(button).not.toBeNull();
  act(() => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

const templateRow = {
  id: 'template-1',
  key: 'custom-template',
  name: 'Custom template',
  subject: 'Hello',
  isSystem: true,
  isActive: true,
  deliveryRunCount: 42,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

const layoutRow = {
  id: 'layout-1',
  key: 'custom-layout',
  name: 'Custom layout',
  htmlContent: '{{content}}',
  campaignCount: 0,
  templateCount: 0,
  deliveryRunCount: 42,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  api.listEmailEventMappingsAction.mockResolvedValue([]);
  api.listEmailTemplatesAdminAction.mockResolvedValue({
    data: [templateRow],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  });
  api.listEmailLayouts.mockResolvedValue({
    data: [layoutRow],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  });
  api.deleteEmailTemplateAction.mockResolvedValue({ success: true });
  api.deleteEmailLayoutAction.mockResolvedValue({ success: true });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  queryClient?.clear();
  root = null;
  container = null;
  queryClient = null;
});

describe('email authoring admin list deletion', () => {
  it('shows template and event mapping read failures instead of empty authoring state', async () => {
    api.listEmailEventMappingsAction.mockRejectedValue(new Error('event catalog unavailable'));
    api.listEmailTemplatesAdminAction.mockRejectedValue(new Error('template catalog unavailable'));

    renderPage(<AdminEmailTemplatesPage />);
    await flush();

    expect(document.body.textContent).toContain('common.errors.generic');
    expect(document.body.textContent).not.toContain('Custom template');
  });

  it('shows layout read failures instead of empty authoring state', async () => {
    api.listEmailLayouts.mockRejectedValue(new Error('layout catalog unavailable'));

    renderPage(<AdminEmailLayoutsPage />);
    await flush();

    expect(document.body.textContent).toContain('common.errors.generic');
    expect(document.body.textContent).not.toContain('Custom layout');
  });

  it('confirms deletion for an unmapped system template despite historical deliveries', async () => {
    renderPage(<AdminEmailTemplatesPage />);
    await flush();

    expect(document.body.textContent).toContain('Custom template');
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/archive|restore|include archived/);
    clickButton('adminList.emailTemplates.delete');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    confirmDelete();
    await flush();

    expect(api.deleteEmailTemplateAction).toHaveBeenCalledWith('template-1');
  });

  it('blocks a currently mapped template before opening the confirmation modal', async () => {
    api.listEmailTemplatesAdminAction.mockResolvedValue({
      data: [{ ...templateRow, eventKey: 'welcome' }],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
    renderPage(<AdminEmailTemplatesPage />);
    await flush();

    clickButton('adminList.emailTemplates.delete');

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(api.deleteEmailTemplateAction).not.toHaveBeenCalled();
    expect(notificationMocks.show).toHaveBeenCalledWith({
      message: 'adminList.emailTemplates.deleteConflict',
      color: 'red',
    });
  });

  it('localizes a template delete conflict returned after confirmation', async () => {
    api.deleteEmailTemplateAction.mockResolvedValue({
      error: '[failed_precondition] email template is frozen by an active delivery run',
      errorCode: 'FAILED_PRECONDITION',
    });
    renderPage(<AdminEmailTemplatesPage />);
    await flush();

    clickButton('adminList.emailTemplates.delete');
    confirmDelete();
    await flush();

    expect(notificationMocks.show).toHaveBeenCalledWith({
      message: 'adminList.emailTemplates.deleteConflict',
      color: 'red',
    });
  });

  it('renders the layout list without archive UI and confirms deletion despite historical deliveries', async () => {
    renderPage(<AdminEmailLayoutsPage />);
    await flush();

    expect(document.body.textContent).toContain('Custom layout');
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/archive|restore|include archived/);
    clickButton('adminList.emailLayouts.delete');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    confirmDelete();
    await flush();

    expect(api.deleteEmailLayoutAction).toHaveBeenCalledWith('layout-1');
  });

  it('blocks a layout with a current template reference before opening the confirmation modal', async () => {
    api.listEmailLayouts.mockResolvedValue({
      data: [{ ...layoutRow, templateCount: 1 }],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
    renderPage(<AdminEmailLayoutsPage />);
    await flush();

    clickButton('adminList.emailLayouts.delete');

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(api.deleteEmailLayoutAction).not.toHaveBeenCalled();
    expect(notificationMocks.show).toHaveBeenCalledWith({
      message: 'adminList.emailLayouts.deleteConflict',
      color: 'red',
    });
  });

  it('localizes a layout delete conflict returned after confirmation', async () => {
    api.deleteEmailLayoutAction.mockResolvedValue({
      error: '[failed_precondition] email layout is frozen by an active delivery run',
      errorCode: 'FAILED_PRECONDITION',
    });
    renderPage(<AdminEmailLayoutsPage />);
    await flush();

    clickButton('adminList.emailLayouts.delete');
    confirmDelete();
    await flush();

    expect(notificationMocks.show).toHaveBeenCalledWith({
      message: 'adminList.emailLayouts.deleteConflict',
      color: 'red',
    });
  });
});
