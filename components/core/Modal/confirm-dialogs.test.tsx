// @vitest-environment jsdom
import { act, render, screen } from '@/test/render';
import { afterEach, expect, it, vi } from 'vitest';
import { confirmDialogs, ConfirmDialogHost, preloadConfirmDialogs } from './confirm-dialogs';
import { getConfirmDialogs } from './confirm-dialog-store';

async function renderHost() {
  const view = render(
    <ConfirmDialogHost loading="eager" loadError={{ message: 'Could not open confirmation.', retryLabel: 'Retry' }} />,
  );
  await act(() => preloadConfirmDialogs());
  return view;
}
afterEach(() => {
  act(() => getConfirmDialogs().forEach(({ id }) => confirmDialogs.close(id)));
});

const labels = {
  title: 'Delete item',
  message: 'Remove this item?',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
  closeLabel: 'Close',
};

it('locks the rendered confirmation and dismissal controls while the command is pending', async () => {
  const { user } = await renderHost();
  let resolve!: () => void;
  const pending = new Promise<void>((done) => {
    resolve = done;
  });
  const confirm = vi.fn(() => pending);
  act(() => {
    confirmDialogs.open({ ...labels, onConfirm: confirm });
  });
  try {
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Delete item' })).toBeInTheDocument();
    expect(confirm).toHaveBeenCalledOnce();
  } finally {
    await act(async () => resolve());
  }
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('cancels an available dialog without starting its command', async () => {
  const { user } = await renderHost();
  const confirm = vi.fn();
  act(() => {
    confirmDialogs.open({ ...labels, onConfirm: confirm });
  });
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(confirm).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
