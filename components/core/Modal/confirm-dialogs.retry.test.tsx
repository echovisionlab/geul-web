// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@/test/render';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.doUnmock('./ConfirmDialogStack');
  vi.useRealTimers();
});

it.each(['explicit retry', 'online', 'new request', 'cancel and reopen'] as const)(
  'ends exhausted loading, retains confirmation intent and recovers through %s',
  async (restart) => {
    vi.resetModules();
    let failing = true;
    const firstAttempt = Promise.withResolvers<void>();
    const renderer = Promise.withResolvers<void>();
    const loader = vi.fn(async (importOriginal: () => Promise<unknown>) => {
      await firstAttempt.promise;
      if (failing) {
        throw new Error('Failed to fetch dynamically imported module');
      }
      await renderer.promise;
      return importOriginal();
    });
    vi.doMock('./ConfirmDialogStack', loader);
    const { ConfirmDialogHost, confirmDialogs, preloadConfirmDialogs } = await import('./confirm-dialogs');
    const onConfirm = vi.fn();
    const recoveryFocus = vi.fn();
    const ids: string[] = [];
    const open = () => {
      ids.push(
        confirmDialogs.open({
          title: ids.length ? 'Delete another item' : 'Delete item',
          message: 'Remove this item?',
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
          closeLabel: 'Close',
          onConfirm,
        }),
      );
    };
    const view = render(
      <div
        onFocusCapture={(event) => {
          if (event.target.getAttribute('role') === 'alert') {
            recoveryFocus();
          }
        }}
      >
        <button type="button" onClick={open}>
          Remove
        </button>
        <ConfirmDialogHost loadError={{ message: '확인 창을 열지 못했습니다.', retryLabel: '다시 시도' }} />
      </div>,
    );
    const { user } = view;
    try {
      const trigger = screen.getByRole('button', { name: 'Remove' });
      await user.click(trigger);
      expect(screen.getByRole('progressbar', { name: 'Delete item' })).toBeVisible();
      expect(trigger).toHaveFocus();
      vi.useFakeTimers();
      await act(async () => {
        firstAttempt.resolve();
        await preloadConfirmDialogs();
      });
      for (const delay of [500, 2000, 5000]) {
        await act(() => vi.advanceTimersByTimeAsync(delay));
      }
      expect(loader).toHaveBeenCalledTimes(4);
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('확인 창을 열지 못했습니다.');
      expect(screen.getByRole('alert')).toHaveFocus();
      expect(recoveryFocus).toHaveBeenCalledOnce();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onConfirm).not.toHaveBeenCalled();
      await act(() => vi.advanceTimersByTimeAsync(30_000));
      expect(loader).toHaveBeenCalledTimes(4);

      vi.useRealTimers();
      if (restart === 'cancel and reopen') {
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
      }
      recoveryFocus.mockClear();
      failing = false;
      if (restart === 'explicit retry') {
        await user.click(screen.getByRole('button', { name: '다시 시도' }));
      } else if (restart === 'online') {
        act(() => window.dispatchEvent(new Event('online')));
      } else {
        await user.click(trigger);
      }
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeVisible();
      expect(recoveryFocus).not.toHaveBeenCalled();
      expect(trigger).toHaveFocus();
      expect(onConfirm).not.toHaveBeenCalled();
      await act(async () => {
        renderer.resolve();
        await preloadConfirmDialogs();
      });
      expect(loader).toHaveBeenCalledTimes(5);
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      expect(
        screen.getByRole('dialog', {
          name: restart === 'new request' || restart === 'cancel and reopen' ? 'Delete another item' : 'Delete item',
        }),
      ).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      if (restart === 'new request') {
        expect(screen.getByRole('dialog', { name: 'Delete item' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
      }
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onConfirm).not.toHaveBeenCalled();
      await waitFor(() => expect(trigger).toHaveFocus());
    } finally {
      view.unmount();
      ids.forEach((id) => confirmDialogs.close(id));
    }
  },
);
