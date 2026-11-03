// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@/test/render';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { FormPasswordContent } from './FormPasswordContent';
import type { QueryResult } from '@/lib/api/query-result';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
it.each(['current', 'target', 'unmount'] as const)(
  'navigates only for the current target after verification, without browser storage, for %s',
  async (mode) => {
    const verification = Promise.withResolvers<QueryResult<{ valid: boolean }>>();
    const accessAction = vi.fn().mockResolvedValue({ accessible: false, reason: 'password_required' });
    const verifyAction = vi.fn().mockReturnValue(verification.promise);
    const onNavigate = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const tree = (slug: string) => (
      <QueryClientProvider client={client}>
        <FormPasswordContent
          slug={slug}
          requestedLocale="en"
          accessAction={accessAction}
          verifyAction={verifyAction}
          onNavigate={onNavigate}
        />
      </QueryClientProvider>
    );
    const view = render(tree('one'));
    const password = await screen.findByLabelText('Password', { exact: true });
    await view.user.type(password, 'submitted-secret');
    await view.user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveAttribute('aria-busy', 'true');
    if (mode === 'target') {
      view.rerender(tree('two'));
    } else if (mode === 'unmount') {
      view.unmount();
    } else {
      await view.user.clear(password);
      await view.user.type(password, 'new-draft');
    }
    await act(async () => verification.resolve({ ok: true, value: { valid: true } }));
    if (mode === 'current') {
      await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('/forms/one?lang=en'));
      expect(verifyAction).toHaveBeenCalledWith('one', 'submitted-secret', undefined);
    } else {
      expect(onNavigate).not.toHaveBeenCalled();
    }
    // The verified password is remembered only by the server action's HttpOnly cookie.
    expect(sessionStorage.length).toBe(0);
    view.unmount();
    client.clear();
  },
);
