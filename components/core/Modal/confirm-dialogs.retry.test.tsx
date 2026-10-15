// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('./ConfirmDialogStack');
  vi.useRealTimers();
});

// Advances fake time in steps so that each retry's state update renders before the next timer.
async function elapse(ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += 250) {
    await act(() => vi.advanceTimersByTimeAsync(250));
  }
}

const request = (title: string) => ({
  title,
  message: 'Remove this item?',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
  closeLabel: 'Close',
  onConfirm: () => undefined,
});

async function setup() {
  vi.resetModules();
  let failing = true;
  const requests = vi.fn();
  // The renderer chunk is unreachable until `failing` is cleared (network loss).
  vi.doMock('./ConfirmDialogStack', async (importOriginal) => {
    requests();
    if (failing) {
      throw new Error('Failed to fetch dynamically imported module');
    }
    return importOriginal();
  });
  vi.useFakeTimers();
  const { ConfirmDialogHost, confirmDialogs } = await import('./confirm-dialogs');
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const first = confirmDialogs.open(request('Delete item'));
  await act(async () => root.render(<ConfirmDialogHost />));
  // The first request and every scheduled retry fail.
  await elapse(30_000);
  const attempts = requests.mock.calls.length;
  expect(attempts).toBeGreaterThan(1);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  await elapse(30_000);
  expect(requests).toHaveBeenCalledTimes(attempts); // no further loads without a new request
  return {
    confirmDialogs,
    recover: () => {
      failing = false;
    },
    requests,
    attempts,
    cleanup: (ids: string[]) => {
      act(() => ids.forEach((id) => confirmDialogs.close(id)));
      act(() => root.unmount());
      host.remove();
    },
    first,
  };
}

it(
  'loads the renderer for a request made after the retries were exhausted while the queue stayed non-empty',
  { timeout: 30000 },
  async () => {
    const { confirmDialogs, recover, requests, attempts, cleanup, first } = await setup();
    recover();
    let second = '';
    await act(async () => {
      second = confirmDialogs.open(request('Delete another item'));
    });
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull(), { timeout: 10000 });
    expect(requests.mock.calls.length).toBeGreaterThan(attempts);
    cleanup([first, second]);
  },
);

it('loads the renderer when the browser comes back online', { timeout: 30000 }, async () => {
  const { recover, cleanup, first } = await setup();
  recover();
  await act(async () => {
    window.dispatchEvent(new Event('online'));
  });
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull(), { timeout: 10000 });
  cleanup([first]);
});
