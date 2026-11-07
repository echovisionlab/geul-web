// @vitest-environment jsdom

import { expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@/test/render';
import { LabelDeleteDialog } from './LabelDeleteDialog';

vi.mock('@/lib/actions/label', () => ({ previewDeleteLabelAction: vi.fn(), deleteLabelAction: vi.fn() }));

const preview = (revision: string) => ({
  ok: true as const,
  value: {
    revision,
    impacts: [],
    childLabelCount: 0,
    artistCount: 0,
    programEventCount: 0,
    releaseCount: 0,
  },
});

it('deletes with the previewed revision', async () => {
  const deleteAction = vi.fn(async () => ({ success: true as const }));
  const onDeleted = vi.fn();
  const { user } = render(
    <LabelDeleteDialog
      label={{ id: 'label', name: 'Label' }}
      onClose={vi.fn()}
      onDeleted={onDeleted}
      previewAction={async () => preview('first')}
      deleteAction={deleteAction as never}
    />,
  );
  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeEnabled());

  await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

  expect(deleteAction).toHaveBeenCalledWith('label', 'first');
  await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
});

it('retries a failed delete with a new preview instead of the stale revision', async () => {
  const deleteAction = vi.fn(async () => ({ error: 'Label changed' }));
  const previewAction = vi.fn().mockResolvedValueOnce(preview('stale')).mockResolvedValueOnce(preview('fresh'));
  const onDeleted = vi.fn();
  const { user } = render(
    <LabelDeleteDialog
      label={{ id: 'label', name: 'Label' }}
      onClose={vi.fn()}
      onDeleted={onDeleted}
      previewAction={previewAction}
      deleteAction={deleteAction as never}
    />,
  );
  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeEnabled());

  await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(previewAction).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeEnabled());
  await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

  expect(deleteAction).toHaveBeenLastCalledWith('label', 'fresh');
  expect(onDeleted).not.toHaveBeenCalled();
});
