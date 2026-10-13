// @vitest-environment jsdom
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { PolicyVersionCreationPage } from './PolicyVersionCreationPage';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/components/core/Notification', () => ({ notifications: { show: vi.fn() } }));
let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
async function run(
  createVersion: () => Promise<{ error?: string; data?: { id: string } }>,
  policy: 'terms' | 'privacy',
) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  const navigate = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  await act(async () =>
    root.render(
      <StrictMode>
        <TestProviders>
          <QueryClientProvider client={client}>
            <PolicyVersionCreationPage policy={policy} createVersion={createVersion} navigate={navigate} />
          </QueryClientProvider>
        </TestProviders>
      </StrictMode>,
    ),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  return navigate;
}
describe('policy automatic draft creation route', () => {
  it('creates only once under StrictMode effect replay and opens the returned draft', async () => {
    const action = vi.fn(async () => ({ data: { id: 'draft-17' } }));
    const navigate = await run(action, 'terms');
    expect(action).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/terms/history/draft-17?edit=true');
  });
  it('returns to its matching list when the action reports an error', async () => {
    const navigate = await run(async () => ({ error: 'Local failure' }), 'privacy');
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/admin/privacy');
  });
  it('does not leave the route spinning forever when the transport rejects', async () => {
    const navigate = await run(async () => {
      throw new Error('Transport unavailable');
    }, 'terms');
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/admin/terms');
  });
});
