// @vitest-environment jsdom
import { StrictMode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@/test/render';
import { PolicyVersionCreationPage } from './PolicyVersionCreationPage';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/components/core/Notification', () => ({ notifications: { show: vi.fn() } }));
async function run(
  createVersion: () => Promise<{ error?: string; data?: { id: string } }>,
  policy: 'terms' | 'privacy',
) {
  const navigate = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <PolicyVersionCreationPage policy={policy} createVersion={createVersion} navigate={navigate} />
      </QueryClientProvider>
    </StrictMode>,
  );
  await waitFor(() => expect(navigate).toHaveBeenCalled());
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
