// @vitest-environment jsdom
import { act, render, screen, within } from '@/test/render';
import { destroyAnnouncer } from 'react-aria/private/live-announcer/LiveAnnouncer';
import { afterEach, expect, it } from 'vitest';
import { NotificationRegion } from './NotificationRegion';
import { notificationQueue, notifications } from './notifications';

let view: ReturnType<typeof render> | undefined;
function renderRegion() {
  destroyAnnouncer();
  notifications.clean();
  view = render(<NotificationRegion closeLabel="닫기" />);
  return view;
}
afterEach(() => {
  view?.unmount();
  view = undefined;
  notifications.clean();
  destroyAnnouncer();
});

it('limits visible notices and dismisses the selected notice with the localized close control', async () => {
  const { user } = renderRegion();
  act(() => {
    for (const message of ['First', 'Second', 'Third', 'Fourth']) {
      notifications.show({ message, autoClose: false });
    }
  });
  expect(screen.getAllByRole('alertdialog')).toHaveLength(3);
  expect(screen.queryByRole('alertdialog', { name: 'First' })).not.toBeInTheDocument();
  const dismissed = screen.getAllByRole('alertdialog')[0];
  await user.click(within(dismissed).getByRole('button', { name: '닫기' }));
  expect(dismissed).not.toBeInTheDocument();
  expect(screen.getAllByRole('alertdialog')).toHaveLength(3);
  expect(screen.getByRole('alertdialog', { name: 'First' })).toBeInTheDocument();
});

it('keeps errors persistent while ordinary success messages have a timeout', () => {
  renderRegion();
  act(() => {
    notifications.show({ message: 'Saved', tone: 'positive' });
    notifications.show({ message: 'Failed', tone: 'danger' });
  });
  const saved = notificationQueue.visibleToasts.find((toast) => toast.content.message === 'Saved')!;
  const failed = notificationQueue.visibleToasts.find((toast) => toast.content.message === 'Failed')!;
  expect(saved.timeout).toBe(5000);
  expect(failed.timeout).toBeUndefined();
});

it('keeps toast title and description relationships valid through dismiss and replacement', () => {
  renderRegion();
  let first = '';
  act(() => {
    first = notifications.show({ title: 'Recording saved', message: 'The draft remains available.', autoClose: false });
  });
  const toast = screen.getByRole('alertdialog', { name: 'Recording saved' });
  expect(toast).toHaveAccessibleDescription('The draft remains available.');
  expect(within(toast).getByRole('alert')).toBeInTheDocument();
  act(() => {
    notifications.hide(first);
    notifications.show({ message: 'A second recording is ready.', autoClose: false });
  });
  expect(toast).not.toBeInTheDocument();
  expect(screen.getByRole('alertdialog', { name: 'A second recording is ready.' })).toBeInTheDocument();
  act(() => notifications.clean());
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument();
});
