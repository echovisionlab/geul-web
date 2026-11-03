// @vitest-environment jsdom
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { NotificationHost, notifications } from '@/components/core/Notification';
import { LanguagePreferenceSettings } from './LanguagePreferenceSettings';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => {
  act(() => notifications.clean());
});
it('ends a rejected locale save with an error and leaves it retryable without refreshing', async () => {
  let reject!: (reason: unknown) => void;
  const update = vi.fn(
    () =>
      new Promise<never>((_resolve, fail) => {
        reject = fail;
      }),
  );
  const refresh = vi.fn();
  const client = new QueryClient();
  const { user } = render(
    <QueryClientProvider client={client}>
      <NotificationHost closeLabel="Close notification" loading="eager" />
      <LanguagePreferenceSettings initialLocale="en" updateAction={update} refresh={refresh} />
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole('button', { name: /Preferred language|English/ }));
  await user.click(await screen.findByRole('option', { name: /한국어/ }));
  const save = screen.getByRole('button', { name: /save/i });
  await user.click(save);
  expect(save).toHaveAttribute('aria-busy', 'true');
  await act(async () => reject(new Error('offline')));
  expect(await screen.findByText('Failed to update language preference')).toBeVisible();
  expect(save).toBeEnabled();
  expect(refresh).not.toHaveBeenCalled();
});
