// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LabelParticipantRole } from '@echovisionlab/geul-proto/secure/label_pb.ts';
import { afterEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@/test/render';
import { LabelParticipantsDialog } from './LabelParticipantsDialog';

const actions = vi.hoisted(() => ({ list: vi.fn(), set: vi.fn(), remove: vi.fn() }));
vi.mock('@/lib/actions/label', () => ({
  listLabelParticipantsAction: actions.list,
  setLabelParticipantAction: actions.set,
  removeLabelParticipantAction: actions.remove,
}));
vi.mock('@/lib/queries/user-browser', () => ({ searchMembers: vi.fn() }));
afterEach(() => vi.resetAllMocks());

it('uses the common initial wait and keeps a role-change command pending until the participant refresh completes', async () => {
  let load!: (result: unknown) => void;
  let save!: (result: unknown) => void;
  let refresh!: (result: unknown) => void;
  const initial = {
    ok: true,
    value: [
      {
        memberId: 'manager',
        nickname: 'Mina',
        role: LabelParticipantRole.MANAGER,
        hasEffectiveAuthority: true,
        avatarUrl: null,
      },
    ],
  };
  actions.list
    .mockReturnValueOnce(
      new Promise((resolve) => {
        load = resolve;
      }),
    )
    .mockReturnValueOnce(
      new Promise((resolve) => {
        refresh = resolve;
      }),
    );
  actions.set.mockReturnValueOnce(
    new Promise((resolve) => {
      save = resolve;
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const { user } = render(
    <QueryClientProvider client={client}>
      <LabelParticipantsDialog opened onClose={vi.fn()} labelId="label" canManageParticipants canRemoveOwner />
    </QueryClientProvider>,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  await act(async () => load(initial));
  const change = await screen.findByRole('button', { name: 'Make owner' });
  await user.click(change);
  expect(change).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('combobox', { name: 'Member' })).toBeDisabled();
  await user.click(change);
  expect(actions.set).toHaveBeenCalledOnce();
  await act(async () => save({ ok: true, success: true }));
  await waitFor(() => expect(actions.list).toHaveBeenCalledTimes(2));
  expect(change).toHaveAttribute('aria-busy', 'true');
  await act(async () => refresh(initial));
  await waitFor(() => expect(change).not.toHaveAttribute('aria-busy', 'true'));
  expect(screen.getByRole('combobox', { name: 'Member' })).toBeEnabled();
  client.clear();
});
