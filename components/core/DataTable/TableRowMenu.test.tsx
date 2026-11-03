// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { RouterProvider } from 'react-aria-components';
import { act, render, screen, waitFor } from '@/test/render';
import { TableRowMenu } from './TableRowMenu';

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<unknown>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('TableRowMenu', () => {
  it.each(['success', 'failure'] as const)(
    'tracks the returned promise after dismissal, blocks duplicates and allows retry after %s',
    async (outcome) => {
      const task = deferred();
      const onClick = vi.fn(() => task.promise);
      const onError = vi.fn();
      const rowClick = vi.fn();
      const { user } = render(
        <div role="row" tabIndex={0} onClick={rowClick} onKeyDown={() => undefined}>
          <TableRowMenu aria-label="Actions for Ada" items={[{ label: 'Unban', onClick, onError }]} />
        </div>,
      );
      const trigger = screen.getByRole('button', { name: 'Actions for Ada' });
      await user.click(trigger);
      await user.click(await screen.findByRole('menuitem', { name: 'Unban' }));
      expect(onClick).toHaveBeenCalledOnce();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(trigger).toHaveAccessibleName('Actions for Ada');
      expect(trigger).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByRole('progressbar', { name: 'Actions for Ada' })).toBeVisible();
      await user.click(trigger);
      await user.keyboard('{Enter} ');
      act(() => trigger.click());
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(onClick).toHaveBeenCalledOnce();
      expect(rowClick).not.toHaveBeenCalled();
      const error = new Error('Permission denied');
      await act(async () => {
        if (outcome === 'success') {
          task.resolve({ updated: true });
        } else {
          task.reject(error);
        }
        await task.promise.catch(() => undefined);
      });
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      expect(trigger).not.toHaveAttribute('aria-busy');
      if (outcome === 'failure') {
        expect(onError).toHaveBeenCalledWith(error);
      } else {
        expect(onError).not.toHaveBeenCalled();
      }
      await user.click(trigger);
      await user.click(await screen.findByRole('menuitem', { name: 'Unban' }));
      expect(onClick).toHaveBeenCalledTimes(2);
    },
  );

  it('preserves keyboard selection, disabled items, navigation and Escape dismissal for synchronous menus', async () => {
    const onClick = vi.fn();
    const blocked = vi.fn();
    const navigate = vi.fn();
    const { user } = render(
      <RouterProvider navigate={navigate}>
        <TableRowMenu
          aria-label="Row actions"
          items={[
            { label: 'Unavailable', disabled: true, onClick: blocked },
            { label: 'Edit', href: '/edit' },
            { label: 'Delete', tone: 'danger', onClick },
          ]}
        />
      </RouterProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'Row actions' });
    await user.click(trigger);
    expect(await screen.findByRole('menuitem', { name: 'Unavailable' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveAttribute('href', '/edit');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.keyboard('{ArrowDown}{End}{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
    expect(blocked).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    await user.click(trigger);
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    expect(navigate).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('observes rejected actions after unmount without reopening or updating the old menu', async () => {
    const task = deferred();
    const onError = vi.fn();
    const { user, unmount } = render(
      <TableRowMenu aria-label="Row actions" items={[{ label: 'Delete', onClick: () => task.promise, onError }]} />,
    );
    await user.click(screen.getByRole('button', { name: 'Row actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    unmount();
    const error = new Error('Failed after navigation');
    await act(async () => {
      task.reject(error);
      await task.promise.catch(() => undefined);
    });
    expect(onError).toHaveBeenCalledWith(error);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('logs unhandled action failures and permits another activation', async () => {
    const error = new Error('Delete failed');
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { user } = render(
        <TableRowMenu aria-label="Row actions" items={[{ label: 'Delete', onClick: () => Promise.reject(error) }]} />,
      );
      const trigger = screen.getByRole('button', { name: 'Row actions' });
      await user.click(trigger);
      await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
      expect(log).toHaveBeenCalledWith('Core command failed', error);
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      await user.click(trigger);
      expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeVisible();
    } finally {
      log.mockRestore();
    }
  });
});
