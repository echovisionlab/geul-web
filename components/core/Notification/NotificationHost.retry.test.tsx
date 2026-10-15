// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('./NotificationRegion');
  vi.useRealTimers();
});

// Advances fake time in steps so that each retry's state update renders before the next timer.
async function elapse(ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += 250) {
    await act(() => vi.advanceTimersByTimeAsync(250));
  }
}

async function setup() {
  vi.resetModules();
  let failing = true;
  const requests = vi.fn();
  // The region chunk is unreachable until `failing` is cleared (network loss).
  vi.doMock('./NotificationRegion', async (importOriginal) => {
    requests();
    if (failing) {
      throw new Error('Failed to fetch dynamically imported module');
    }
    return importOriginal();
  });
  vi.useFakeTimers();
  const { NotificationHost } = await import('./NotificationHost');
  const { notifications } = await import('./notifications');
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  notifications.show({ title: 'Saved', message: 'The draft is stored.', autoClose: false });
  await act(async () => root.render(<NotificationHost closeLabel="Close" />));
  // The first request and every scheduled retry fail.
  await elapse(30_000);
  const attempts = requests.mock.calls.length;
  expect(attempts).toBeGreaterThan(1);
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  await elapse(30_000);
  expect(requests).toHaveBeenCalledTimes(attempts); // no further loads without a new request
  return {
    notifications,
    recover: () => {
      failing = false;
    },
    requests,
    attempts,
    cleanup: () => {
      act(() => notifications.clean());
      act(() => root.unmount());
      host.remove();
    },
  };
}

it(
  'loads the region for a notice shown after the retries were exhausted while the queue stayed non-empty',
  { timeout: 30000 },
  async () => {
    const { notifications, recover, requests, attempts, cleanup } = await setup();
    recover();
    await act(async () => {
      notifications.show({ title: 'Published', message: 'The post is live.', autoClose: false });
    });
    await vi.waitFor(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeNull(), {
      timeout: 10000,
    });
    expect(requests.mock.calls.length).toBeGreaterThan(attempts);
    expect(document.querySelectorAll('[role="alertdialog"]')).toHaveLength(2);
    cleanup();
  },
);

it('loads the region when the browser comes back online', { timeout: 30000 }, async () => {
  const { recover, cleanup } = await setup();
  recover();
  await act(async () => {
    window.dispatchEvent(new Event('online'));
  });
  await vi.waitFor(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeNull(), {
    timeout: 10000,
  });
  cleanup();
});
