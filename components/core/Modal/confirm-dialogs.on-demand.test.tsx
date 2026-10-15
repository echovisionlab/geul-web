// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { confirmDialogs, ConfirmDialogHost, preloadConfirmDialogs } from './confirm-dialogs';

// The first dynamic import transforms the React Aria dialog graph; allow for a cold module cache.
it(
  'keeps a request made before the renderer loads, opens it, and restores focus to the trigger',
  { timeout: 20000 },
  async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Remove';
    document.body.append(trigger);
    trigger.focus();
    const onConfirm = vi.fn();
    // Opened before any host has loaded the renderer: the request waits in the store.
    confirmDialogs.open({
      title: 'Delete item',
      message: 'Remove this item?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      closeLabel: 'Close',
      onConfirm,
    });
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<ConfirmDialogHost />));
    // The host requested the renderer chunk when it saw the queued request; wait for that chunk.
    await act(() => preloadConfirmDialogs());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('[role="dialog"]')).toHaveAccessibleName('Delete item');
    const cancel = [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Cancel')!;
    await act(async () => cancel.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(trigger).toHaveFocus());
    act(() => root.unmount());
    host.remove();
    trigger.remove();
  },
);

it('renders nothing on the server and before any request', async () => {
  const { renderToString } = await import('react-dom/server');
  expect(renderToString(<ConfirmDialogHost />)).toBe('');
});
