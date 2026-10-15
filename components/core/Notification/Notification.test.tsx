// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { NotificationRegion } from './NotificationRegion';
import { notificationQueue, notifications } from './notifications';
let host: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  notifications.clean();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<NotificationRegion closeLabel="닫기" />));
});
afterEach(() => {
  act(() => {
    notifications.clean();
    root.unmount();
  });
  host.remove();
});
it('limits visible notices and dismisses the selected notice with the localized close control', async () => {
  await act(async () => {
    for (const message of ['First', 'Second', 'Third', 'Fourth']) {
      notifications.show({ message, autoClose: false });
    }
  });
  expect(notificationQueue.visibleToasts).toHaveLength(3);
  expect(document.body.textContent).not.toContain('First');
  const button = document.querySelector<HTMLButtonElement>('button[aria-label="닫기"]')!;
  await act(async () => button.click());
  expect(notificationQueue.visibleToasts).toHaveLength(3);
  expect(document.body.textContent).toContain('First');
});
it('keeps errors persistent while ordinary success messages have a timeout', async () => {
  await act(async () => {
    notifications.show({ message: 'Saved', tone: 'positive' });
    notifications.show({ message: 'Failed', tone: 'danger' });
  });
  const saved = notificationQueue.visibleToasts.find((toast) => toast.content.message === 'Saved')!;
  const failed = notificationQueue.visibleToasts.find((toast) => toast.content.message === 'Failed')!;
  expect(saved.timeout).toBe(5000);
  expect(failed.timeout).toBeUndefined();
});
it('keeps toast title and description relationships valid through dismiss and replacement', async () => {
  let first = '';
  await act(async () => {
    first = notifications.show({ title: 'Recording saved', message: 'The draft remains available.', autoClose: false });
  });
  const toast = document.querySelector('[role="alertdialog"]')!;
  expect(toast).toHaveAccessibleName('Recording saved');
  expect(toast).toHaveAccessibleDescription('The draft remains available.');
  expect(toast.querySelector('[role="alert"]')).not.toBeNull();
  await act(async () => {
    notifications.hide(first);
    notifications.show({ message: 'A second recording is ready.', autoClose: false });
  });
  expect(toast.isConnected).toBe(false);
  expect(document.querySelector('[role="alertdialog"]')).toHaveAccessibleName('A second recording is ready.');
  for (const node of document.querySelectorAll('[aria-labelledby], [aria-describedby]')) {
    for (const attribute of ['aria-labelledby', 'aria-describedby']) {
      for (const id of node.getAttribute(attribute)?.split(/\s+/).filter(Boolean) ?? []) {
        expect(document.getElementById(id), `${attribute}=${id}`).not.toBeNull();
      }
    }
  }
  await act(async () => notifications.clean());
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  expect(document.querySelector('[data-live-announcer] [role="img"]')).toBeNull();
});
