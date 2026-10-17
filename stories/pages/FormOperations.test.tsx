// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, it, expect, onTestFinished, vi } from 'vitest';
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
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  sessionStorage.clear();
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
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}
describe('actual form operations page previews', () => {
  it('loads actual submissions query/table and fixture rows', async () => {
    render('submissions');
    await flush();
    expect(host.textContent).toContain('KR');
    expect(host.querySelector('input')).not.toBeNull();
    expect(host.querySelector('a[href$="submission-1"]')).not.toBeNull();
  });
  it('renders submission metadata/responses and actual delete modal', async () => {
    render('detail');
    expect(host.textContent).toContain('June Han');
    expect(host.textContent).toContain('192.0.2.1');
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="Delete"]');
    expect(button).not.toBeNull();
    await act(async () => button!.click());
    expect(document.body.querySelector('[role=dialog]')).not.toBeNull();
  });
  it('runs dashboard access then real data/chart composition', async () => {
    // jsdom has no layout; give the chart plot the size its CSS supplies in a browser.
    const measure = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(0, 0, 400, 300));
    onTestFinished(() => measure.mockRestore());
    render('dashboard');
    await flush();
    await flush();
    expect(host.textContent).toContain('Listening Room');
    expect(host.textContent).toContain('24');
    expect(host.textContent).toContain('Session');
    expect(host.querySelector('[aria-label="Chart type"]')).not.toBeNull();
  });
  it('retains actual invalid dashboard branch', () => {
    render('dashboard', 'invalid');
    expect(host.textContent?.toLowerCase()).toContain('invalid');
  });
  it('renders the actual password controller after access check', async () => {
    render('password');
    await flush();
    await flush();
    expect(host.querySelector('input[type=password]')).not.toBeNull();
    expect(host.querySelector('form')).not.toBeNull();
  });
});
