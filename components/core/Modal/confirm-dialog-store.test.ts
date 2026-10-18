// @geul-test-isolate: the confirm dialog store keeps queued entries across imports.
import { afterEach, expect, it, vi } from 'vitest';
import { confirmDialog, confirmDialogs, getConfirmDialogs, type ConfirmDialogOptions } from './confirm-dialog-store';

const labels = {
  title: 'Delete item',
  message: 'Remove this item?',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
  closeLabel: 'Close',
};
const open = (options: Pick<ConfirmDialogOptions, 'onConfirm' | 'onError'>) =>
  confirmDialogs.open({ ...labels, ...options });

afterEach(() => {
  getConfirmDialogs().forEach(({ id }) => confirmDialogs.close(id));
});

it.each([
  ['rejects', (failure: Error) => Promise.reject(failure)],
  [
    'throws synchronously',
    (failure: Error) => {
      throw failure;
    },
  ],
])('keeps a confirmation whose command %s available for a retry after reporting the error', async (_, fail) => {
  const failure = new Error('Offline');
  const onConfirm = vi
    .fn<() => void | Promise<void>>()
    .mockImplementationOnce(() => fail(failure))
    .mockImplementationOnce(() => undefined);
  const onError = vi.fn();
  const id = open({ onConfirm, onError });
  const confirmation = confirmDialog(id);
  expect(getConfirmDialogs()).toMatchObject([{ id, pending: true }]);
  await confirmation;
  expect(onError).toHaveBeenCalledWith(failure);
  expect(getConfirmDialogs()).toMatchObject([{ id, pending: false }]);
  await confirmDialog(id);
  expect(getConfirmDialogs()).toEqual([]);
  expect(onConfirm).toHaveBeenCalledTimes(2);
  expect(onError).toHaveBeenCalledOnce();
});

it('blocks cancellation and repeated confirmations while the first command is pending', async () => {
  let resolve!: () => void;
  const pending = new Promise<void>((done) => {
    resolve = done;
  });
  const onConfirm = vi.fn(() => pending);
  const id = open({ onConfirm });
  const confirmation = confirmDialog(id);
  try {
    confirmDialog(id);
    confirmDialogs.close(id);
    expect(getConfirmDialogs()).toMatchObject([{ id, pending: true }]);
  } finally {
    resolve();
    await confirmation;
  }
  expect(onConfirm).toHaveBeenCalledOnce();
  expect(getConfirmDialogs()).toEqual([]);
});

it('ignores closed IDs and older dialogs until they become the newest dialog again', async () => {
  const onConfirm = vi.fn();
  const older = open({ onConfirm });
  const closed = open({ onConfirm });
  confirmDialogs.close(closed);
  const newer = open({ onConfirm });

  await confirmDialog(closed);
  await confirmDialog(older);
  expect(onConfirm).not.toHaveBeenCalled();
  expect(getConfirmDialogs()).toMatchObject([
    { id: older, pending: false },
    { id: newer, pending: false },
  ]);

  confirmDialogs.close(newer);
  await confirmDialog(older);
  expect(onConfirm).toHaveBeenCalledOnce();
  expect(getConfirmDialogs()).toEqual([]);
});

it.each(['success', 'failure'] as const)(
  'preserves a newly opened dialog when an older pending command settles with %s',
  async (outcome) => {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const pending = new Promise<void>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    const onError = vi.fn();
    const failure = new Error('Offline');
    const older = open({ onConfirm: () => pending, onError });
    const confirmation = confirmDialog(older);
    const newerConfirm = vi.fn();
    const newer = open({ onConfirm: newerConfirm });

    if (outcome === 'success') {
      resolve();
    } else {
      reject(failure);
    }
    await confirmation;

    expect(newerConfirm).not.toHaveBeenCalled();
    expect(getConfirmDialogs().at(-1)).toMatchObject({ id: newer, pending: false });
    if (outcome === 'success') {
      expect(getConfirmDialogs()).toHaveLength(1);
      expect(onError).not.toHaveBeenCalled();
    } else {
      expect(getConfirmDialogs()).toHaveLength(2);
      expect(getConfirmDialogs()[0]).toMatchObject({ id: older, pending: false });
      expect(onError).toHaveBeenCalledWith(failure);
    }
  },
);
