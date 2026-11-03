// @vitest-environment jsdom
// @geul-test-isolate: the renderer module must begin unloaded to exercise the first request.
import { useState } from 'react';
import { act, render, screen, waitFor } from '@/test/render';
import { afterEach, expect, it, vi } from 'vitest';
import { confirmDialogs, ConfirmDialogHost, preloadConfirmDialogs } from './confirm-dialogs';
import { getConfirmDialogs } from './confirm-dialog-store';

afterEach(() => {
  vi.doUnmock('./ConfirmDialogStack');
  act(() => getConfirmDialogs().forEach(({ id }) => confirmDialogs.close(id)));
});

it('keeps a request made before the host loads, opens it, and restores focus to the trigger', async () => {
  const renderer = Promise.withResolvers<void>();
  vi.doMock('./ConfirmDialogStack', async (importOriginal) => {
    await renderer.promise;
    return importOriginal();
  });
  const onConfirm = vi.fn();
  function Example() {
    const [showHost, setShowHost] = useState(false);
    return (
      <>
        <button
          type="button"
          onClick={() => {
            confirmDialogs.open({
              title: 'Delete item',
              message: 'Remove this item?',
              confirmLabel: 'Delete',
              cancelLabel: 'Cancel',
              closeLabel: 'Close',
              onConfirm,
            });
            setShowHost(true);
          }}
        >
          Remove
        </button>
        {showHost ? (
          <ConfirmDialogHost loadError={{ message: 'Could not open confirmation.', retryLabel: 'Retry' }} />
        ) : null}
      </>
    );
  }
  const { user } = render(<Example />);
  const trigger = screen.getByRole('button', { name: 'Remove' });
  await user.click(trigger);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'Delete item' })).toBeVisible();
  expect(trigger).toHaveFocus();
  renderer.resolve();
  await act(() => preloadConfirmDialogs());
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Delete item' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(onConfirm).not.toHaveBeenCalled();
  await waitFor(() => expect(trigger).toHaveFocus());
});
