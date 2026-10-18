// @vitest-environment jsdom
import { act, render, screen } from '@/test/render';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('./NotificationRegion');
  vi.useRealTimers();
});

it('shows every queued notice once a later notice reloads the failed region', async () => {
  let failing = true;
  vi.doMock('./NotificationRegion', async (importOriginal) => {
    if (failing) {
      throw new Error('Failed to fetch dynamically imported module');
    }
    return importOriginal();
  });
  vi.useFakeTimers();
  const { NotificationHost, preloadNotificationRegion } = await import('./NotificationHost');
  const { notifications } = await import('./notifications');
  notifications.show({ title: 'Saved', message: 'The draft is stored.', autoClose: false });
  const view = render(<NotificationHost closeLabel="Close" />);
  try {
    await act(() => preloadNotificationRegion());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    failing = false;
    act(() => {
      notifications.show({ title: 'Published', message: 'The post is live.', autoClose: false });
    });
    await act(() => preloadNotificationRegion());
    expect(screen.getAllByRole('alertdialog')).toHaveLength(2);
    expect(screen.getByRole('alertdialog', { name: 'Saved' })).toHaveTextContent('The draft is stored.');
    expect(screen.getByRole('alertdialog', { name: 'Published' })).toHaveTextContent('The post is live.');
  } finally {
    view.unmount();
    notifications.clean();
  }
});
