// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listSubmissions: vi.fn(),
  deleteSubmission: vi.fn(),
}));

vi.mock('@/lib/actions/form', () => ({
  listFormSubmissionsAction: mocks.listSubmissions,
  deleteFormSubmissionAction: mocks.deleteSubmission,
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

import AdminFormSubmissionsPage from './AdminFormSubmissionsPage';

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

class TestResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = TestResizeObserver;

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;
const scheduledNotifications = new Set<ReturnType<typeof setTimeout>>();

async function render() {
  await act(async () => {
    root.render(
      <DesignSystemProvider forceColorScheme="light">
        <QueryClientProvider client={queryClient}>
          <AdminFormSubmissionsPage formId="form-1" editBaseHref="/admin/forms/form-1/submissions" />
        </QueryClientProvider>
      </DesignSystemProvider>,
    );
  });
}

beforeEach(() => {
  // Keep query notifications asynchronous and prove assertions await rendering.
  notifyManager.setScheduler((callback) => {
    const timer = setTimeout(() => {
      scheduledNotifications.delete(timer);
      act(callback);
    }, 25);
    scheduledNotifications.add(timer);
  });
  mocks.listSubmissions.mockReset();
  mocks.deleteSubmission.mockReset().mockResolvedValue({ success: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(async () => {
  await act(async () => {
    await queryClient.cancelQueries();
    root.unmount();
    queryClient.clear();
  });
  for (const timer of scheduledNotifications) clearTimeout(timer);
  scheduledNotifications.clear();
  notifyManager.setScheduler((callback) => setTimeout(callback, 0));
  container.remove();
});

describe('AdminFormSubmissionsPage loading failures', () => {
  it('shows an error and retries instead of presenting RPC failure as an empty list', async () => {
    mocks.listSubmissions.mockResolvedValueOnce({ ok: false, code: 'LIST_SUBMISSIONS_FAILED' }).mockResolvedValueOnce({
      ok: true,
      data: { submissions: [], total: 0, page: 1, limit: 20, totalPages: 0 },
    });

    await render();
    await vi.waitFor(
      async () => {
        await act(async () => {
          await Promise.resolve();
        });
        expect(mocks.listSubmissions).toHaveBeenCalledTimes(1);
        expect(container.textContent).toContain('common.errors.generic');
      },
      { timeout: 5000 },
    );
    expect(container.textContent).not.toContain('formAdmin.submissions.empty');
    expect(container.textContent).toContain('common.actions.tryAgain');

    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await vi.waitFor(
      async () => {
        await act(async () => {
          await Promise.resolve();
        });
        expect(mocks.listSubmissions).toHaveBeenCalledTimes(2);
        expect(container.textContent).not.toContain('common.errors.generic');
        expect(container.textContent).toContain('formAdmin.submissions.empty');
      },
      { timeout: 5000 },
    );
  });
});
