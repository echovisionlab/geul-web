// @vitest-environment jsdom

import { act, render, renderHook, screen } from '@/test/render';
import { expect, it, vi } from 'vitest';
import { EditorHeaderView, type EditorHeaderViewLabels } from './EditorHeader/EditorHeaderView';
import { ImageUploadField } from './ImageUpload/ImageUploadField';
import { MenuToggle } from './MenuToggle/MenuToggle';
import { usePendingAction } from './use-pending-action';

it('preserves the command result and rejection while clearing pending for another run', async () => {
  const task = Promise.withResolvers<string>();
  const error = new Error('Removal failed');
  const report = vi.spyOn(console, 'error').mockImplementation(() => {});
  const command = vi.fn(() => task.promise).mockRejectedValueOnce(error);
  const { result } = renderHook(() => usePendingAction(command));
  try {
    let rejected: ReturnType<typeof result.current.run>;
    act(() => {
      rejected = result.current.run();
    });
    expect(result.current.pending).toBe(true);
    await act(async () => {
      await expect(rejected).rejects.toBe(error);
    });
    expect(result.current.pending).toBe(false);

    let resolved: ReturnType<typeof result.current.run>;
    act(() => {
      resolved = result.current.run();
    });
    expect(result.current.pending).toBe(true);
    await act(async () => {
      task.resolve('removed');
      await expect(resolved).resolves.toBe('removed');
    });
    expect(result.current.pending).toBe(false);
  } finally {
    report.mockRestore();
  }
});

const labels: EditorHeaderViewLabels = {
  title: 'Title',
  back: 'Back',
  untitled: 'Untitled',
  delete: 'Delete',
  cancel: 'Cancel',
  close: 'Close',
  changeStatus: 'Change status',
  collabButton: 'Collaboration',
  connection: 'Connection',
  current: 'Current',
  status: 'Status',
  actions: 'Actions',
  syncStatus: 'Synced',
};

it.each([
  { control: 'Back', outcome: 'resolve' },
  { control: 'Remove logo', outcome: 'reject' },
] as const)(
  'tracks the $control promise, blocks duplicates and recovers after $outcome',
  async ({ control, outcome }) => {
    const task = Promise.withResolvers<void>();
    const command = vi.fn(() => task.promise);
    const error = new Error('Command failed');
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { user } = render(
        control === 'Back' ? (
          <EditorHeaderView title="Draft post" onBack={command} isConnected isSynced labels={labels} />
        ) : (
          <ImageUploadField
            alt="Logo"
            imageUrl="/logo.png"
            preview={{ mode: 'hug', maxWidth: 320, maxHeight: 120 }}
            onRemove={command}
            removeButtonAriaLabel="Remove logo"
          />
        ),
      );
      const button = screen.getByRole('button', { name: control });
      await user.click(button);
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByRole('progressbar', { name: control })).toBeVisible();
      await user.keyboard('{Enter}');
      expect(command).toHaveBeenCalledOnce();
      await act(async () => {
        if (outcome === 'reject') {
          task.reject(error);
        } else {
          task.resolve();
        }
      });
      expect(button).not.toHaveAttribute('aria-busy');
      expect(button).toHaveFocus();
      if (outcome === 'reject') {
        expect(report).toHaveBeenCalledWith('Core command failed', error);
      }
      await user.click(button);
      expect(command).toHaveBeenCalledTimes(2);
    } finally {
      report.mockRestore();
    }
  },
);

it('keeps navigation focus and disclosure semantics while its module is loading', async () => {
  const onClick = vi.fn();
  const { user, rerender } = render(
    <MenuToggle opened={false} label="Toggle navigation" controls="navigation" onClick={onClick} />,
  );
  const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
  await user.click(toggle);
  rerender(<MenuToggle opened loading label="Toggle navigation" controls="navigation" onClick={onClick} />);
  expect(toggle).toHaveFocus();
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(toggle).toHaveAttribute('aria-controls', 'navigation');
  expect(toggle).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('progressbar', { name: 'Toggle navigation' })).toBeVisible();
  await user.click(toggle);
  await user.keyboard('{Enter}');
  expect(onClick).toHaveBeenCalledOnce();
  rerender(<MenuToggle opened label="Toggle navigation" controls="navigation" onClick={onClick} />);
  await user.keyboard('{Enter}');
  expect(onClick).toHaveBeenCalledTimes(2);
});
