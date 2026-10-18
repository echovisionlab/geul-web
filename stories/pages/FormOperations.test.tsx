// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { notifyManager } from '@tanstack/react-query';
import { TestProviders } from '@/test/TestProviders';
import { FormOperationsPreview } from './FormOperations.stories';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }) }));
vi.mock('@/lib/actions/form', () => ({
  listFormSubmissionsAction: vi.fn(),
  deleteFormSubmissionAction: vi.fn(),
  checkFormAccessAction: vi.fn(),
  getFormDashboardByShareAction: vi.fn(),
  verifyFormPasswordAction: vi.fn(),
}));
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  // Deliver query results inside act so waits observe committed renders.
  notifyManager.setNotifyFunction((callback) => {
    act(callback);
  });
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  sessionStorage.clear();
  notifyManager.setNotifyFunction((callback) => callback());
});
function render(
  surface: 'submissions' | 'detail' | 'dashboard' | 'password',
  state: 'ready' | 'empty' | 'invalid' = 'ready',
) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root.render(
      <TestProviders>
        <FormOperationsPreview surface={surface} state={state} />
      </TestProviders>,
    ),
  );
}
describe('actual form operations page previews', () => {
  it('renders submission metadata/responses and actual delete modal', async () => {
    render('detail');
    expect(host.textContent).toContain('June Han');
    expect(host.textContent).toContain('192.0.2.1');
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="Delete"]');
    expect(button).not.toBeNull();
    await act(async () => button!.click());
    expect(document.body.querySelector('[role=dialog]')).not.toBeNull();
  });
});
