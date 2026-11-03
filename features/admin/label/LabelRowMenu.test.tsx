// @vitest-environment jsdom

import { expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@/test/render';
import enMessages from '@/messages/en.json';
import { LabelRowMenu } from './LabelRowMenu';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/actions/label', () => ({ previewDeleteLabelAction: vi.fn(), deleteLabelAction: vi.fn() }));

it('opens the lookup wait immediately and ignores a late response after the user closes it', async () => {
  let finish!: (
    value: Awaited<ReturnType<NonNullable<import('./LabelRowMenu').LabelRowMenuProps['previewAction']>>>,
  ) => void;
  const pending = new Promise<
    Awaited<ReturnType<NonNullable<import('./LabelRowMenu').LabelRowMenuProps['previewAction']>>>
  >((resolve) => {
    finish = resolve;
  });
  const { user } = render(<LabelRowMenu label={{ id: 'label', name: 'Label' }} previewAction={() => pending} />);
  await user.click(screen.getByRole('button', { name: /Label/ }));
  await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('status')).toHaveTextContent(enMessages.common.states.loading);
  expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeDisabled();
  await user.click(within(dialog).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await act(async () =>
    finish({
      ok: true,
      value: {
        revision: 'revision',
        impacts: [],
        childLabelCount: 0,
        artistCount: 0,
        programEventCount: 0,
        releaseCount: 0,
      },
    }),
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
