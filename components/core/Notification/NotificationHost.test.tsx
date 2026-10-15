// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { NotificationHost, preloadNotificationRegion } from './NotificationHost';
import { notifications } from './notifications';

// The first dynamic import transforms the React Aria toast graph; allow for a cold module cache.
it('queues notices shown before the region loads and displays them once it arrives', { timeout: 20000 }, async () => {
  // Shown before any host exists, e.g. from an early effect.
  notifications.show({ title: 'Saved', message: 'The draft is stored.', autoClose: false });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<NotificationHost closeLabel="Close" />));
  // The host requested the region chunk when it saw the queued notice; wait for that chunk.
  await act(() => preloadNotificationRegion());
  expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
  expect(document.querySelector('[role="alertdialog"]')).toHaveAccessibleName('Saved');
  await act(async () => notifications.clean());
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  act(() => root.unmount());
  host.remove();
});

it('renders no markup on the server or while the queue is empty', async () => {
  const { renderToString } = await import('react-dom/server');
  expect(renderToString(<NotificationHost closeLabel="Close" />)).toBe('');
});
