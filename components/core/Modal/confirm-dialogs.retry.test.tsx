// @vitest-environment jsdom
import { act, render, screen } from '@/test/render';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('./ConfirmDialogStack');
  vi.useRealTimers();
});

const request = (title: string) => ({
  title,
  message: 'Remove this item?',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
  closeLabel: 'Close',
  onConfirm: () => undefined,
});

it('loads the renderer for a new request after an earlier load failed and retains both dialogs', async () => {
  let failing = true;
  vi.doMock('./ConfirmDialogStack', async (importOriginal) => {
    if (failing) {
      throw new Error('Failed to fetch dynamically imported module');
    }
    return importOriginal();
  });
  vi.useFakeTimers();
  const { ConfirmDialogHost, confirmDialogs, preloadConfirmDialogs } = await import('./confirm-dialogs');
  const ids = [confirmDialogs.open(request('Delete item'))];
  const view = render(<ConfirmDialogHost />);
  try {
    await act(() => preloadConfirmDialogs());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    failing = false;
    act(() => {
      ids.push(confirmDialogs.open(request('Delete another item')));
    });
    await act(() => preloadConfirmDialogs());
    expect(screen.getByRole('dialog', { name: 'Delete another item' })).toBeInTheDocument();

    act(() => confirmDialogs.close(ids[1]));
    expect(screen.getByRole('dialog', { name: 'Delete item' })).toBeInTheDocument();
  } finally {
    view.unmount();
    ids.forEach((id) => confirmDialogs.close(id));
  }
});
