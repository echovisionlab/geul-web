// @vitest-environment jsdom

import { expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@/test/render';
import enMessages from '@/messages/en.json';
import { ProgramEventTypeManagerButton } from './ProgramEventTypeManager';

vi.mock('@/lib/actions/program-event', () => ({
  createProgramEventTypeAction: vi.fn(),
  updateProgramEventTypeAction: vi.fn(),
  deleteProgramEventTypeAction: vi.fn(),
}));

it('releases failed save pending without losing the editable type draft', async () => {
  let reject!: (error: unknown) => void;
  const pending = new Promise<never>((_resolve, fail) => {
    reject = fail;
  });
  const { user } = render(
    <ProgramEventTypeManagerButton
      initialTypes={[]}
      bindings={{
        createProgramEventTypeAction: () => pending,
        updateProgramEventTypeAction: vi.fn(),
        deleteProgramEventTypeAction: vi.fn(),
      }}
    />,
  );
  await user.click(screen.getByRole('button', { name: enMessages.programEventAdmin.types.title }));
  const dialog = await screen.findByRole('dialog');
  const name = within(dialog).getByRole('textbox', { name: 'Name' });
  const slug = within(dialog).getByRole('textbox', { name: 'Slug' });
  await user.click(name);
  await user.paste('Talk');
  await user.click(slug);
  await user.paste('talk');
  const save = within(dialog).getByRole('button', { name: 'Save' });
  await user.click(save);
  expect(save).toHaveAttribute('aria-busy', 'true');
  expect(name).toBeDisabled();
  expect(within(dialog).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
  await user.keyboard('{Escape}');
  expect(dialog).toBeInTheDocument();
  await act(async () => reject(new Error('Unavailable')));
  await waitFor(() => expect(save).toBeEnabled());
  expect(save).not.toHaveAttribute('aria-busy', 'true');
  expect(name).toHaveValue('Talk');
  expect(name).toBeEnabled();
});
