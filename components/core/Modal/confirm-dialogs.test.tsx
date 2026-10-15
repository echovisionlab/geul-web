// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { confirmDialogs, ConfirmDialogHost, preloadConfirmDialogs } from './confirm-dialogs';
let host: HTMLDivElement;
let root: Root;
let id: string;
beforeEach(async () => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<ConfirmDialogHost loading="eager" />));
  await act(() => preloadConfirmDialogs());
});
afterEach(() => {
  act(() => {
    confirmDialogs.close(id);
    root.unmount();
  });
  host.remove();
});
const labels = {
  title: 'Delete item',
  message: 'Remove this item?',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
  closeLabel: 'Close',
};
function button(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === label)!;
}
it('locks dismissal and duplicate confirmation until the async operation succeeds', async () => {
  let resolve!: () => void;
  const pending = new Promise<void>((done) => {
    resolve = done;
  });
  const confirm = vi.fn(() => pending);
  await act(async () => {
    id = confirmDialogs.open({ ...labels, onConfirm: confirm });
  });
  await act(async () => button('Delete').click());
  expect(button('Delete').disabled).toBe(true);
  expect(button('Cancel').disabled).toBe(true);
  await act(async () => {
    confirmDialogs.close(id);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(confirm).toHaveBeenCalledTimes(1);
  await act(async () => resolve());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it('keeps a failed confirmation open and allows retry after reporting the error', async () => {
  const error = new Error('Offline');
  const confirm = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);
  const onError = vi.fn();
  await act(async () => {
    id = confirmDialogs.open({ ...labels, onConfirm: confirm, onError });
  });
  await act(async () => button('Delete').click());
  expect(onError).toHaveBeenCalledWith(error);
  expect(button('Delete').disabled).toBe(false);
  await act(async () => button('Delete').click());
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it('starts one operation when confirmation clicks arrive before the pending render commits', async () => {
  let resolve!: () => void;
  const confirm = vi.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  await act(async () => {
    id = confirmDialogs.open({ ...labels, onConfirm: confirm });
  });
  await act(async () => {
    const action = button('Delete');
    action.click();
    action.click();
  });
  expect(confirm).toHaveBeenCalledOnce();
  await act(async () => resolve());
});

it('cancels an available dialog without starting its command', async () => {
  const confirm = vi.fn();
  await act(async () => {
    id = confirmDialogs.open({ ...labels, onConfirm: confirm });
  });
  await act(async () => button('Cancel').click());
  expect(confirm).not.toHaveBeenCalled();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it('handles a synchronous command failure through the same retry contract', async () => {
  const failure = new Error('Rejected synchronously');
  const confirm = vi
    .fn()
    .mockImplementationOnce(() => {
      throw failure;
    })
    .mockImplementationOnce(() => {});
  const error = vi.fn();
  await act(async () => {
    id = confirmDialogs.open({ ...labels, onConfirm: confirm, onError: error });
  });
  await act(async () => button('Delete').click());
  expect(error).toHaveBeenCalledWith(failure);
  expect(button('Delete').disabled).toBe(false);
  await act(async () => button('Delete').click());
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
