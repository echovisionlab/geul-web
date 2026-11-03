// @vitest-environment jsdom

import { act, render, screen, waitFor, within } from '@/test/render';
import { MemberCriteriaKind } from '@echovisionlab/geul-proto/secure/member_criteria_pb.ts';
import { AuthorizationRole } from '@echovisionlab/geul-proto/policy/access_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberCriteriaModals } from './MemberCriteriaModals';
import { CriteriaModalProvider, useCriteriaModal } from './MemberCriteriaModalContext';

const actions = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), estimate: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/actions/member-criteria', () => ({
  archiveMemberCriteriaAction: vi.fn(),
  createMemberCriteriaAction: vi.fn(),
  countMatchingMembersAction: actions.estimate,
  getMemberCriteriaAction: actions.get,
  restoreMemberCriteriaAction: vi.fn(),
  updateMemberCriteriaAction: actions.update,
}));

function Controls() {
  const { openEdit } = useCriteriaModal();
  return (
    <>
      <button type="button" onClick={() => openEdit('criteria-a')}>
        Edit criteria A
      </button>
      <button type="button" onClick={() => openEdit('criteria-b')}>
        Edit criteria B
      </button>
    </>
  );
}

function Scenario() {
  return (
    <CriteriaModalProvider>
      <Controls />
      <MemberCriteriaModals refresh={() => {}} />
    </CriteriaModalProvider>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function criteria(name: string, accountRoles: string[] = ['user']) {
  return {
    data: {
      id: 'criteria-a',
      name,
      description: 'A description',
      kind: MemberCriteriaKind.FILTER,
      config: { memberTagIds: [], accountRoles, createdAfter: undefined, createdBefore: undefined },
      estimatedCount: 20,
      archivedAt: null,
    },
  };
}

beforeEach(() => {
  actions.get.mockReset();
  actions.update.mockReset();
  actions.estimate.mockReset();
});

describe('MemberCriteriaModals edit lifecycle', () => {
  it('ignores a stale load after closing one criteria and opening another', async () => {
    const criteriaA = deferred<ReturnType<typeof criteria>>();
    const criteriaB = deferred<ReturnType<typeof criteria>>();
    actions.get.mockImplementation((id: string) => (id === 'criteria-a' ? criteriaA.promise : criteriaB.promise));
    const { user } = render(<Scenario />);
    await user.click(screen.getByRole('button', { name: 'Edit criteria A' }));
    let dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit criteria B' }));
    await act(async () => {
      criteriaB.resolve(criteria('Criteria B'));
      await criteriaB.promise;
    });
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Criteria B');
    await act(async () => {
      criteriaA.resolve(criteria('Criteria A'));
      await criteriaA.promise;
    });
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Criteria B');
  });

  it('sends touched scalar fields and keeps typing over the canonical save response', async () => {
    const pending = deferred<ReturnType<typeof criteria>>();
    actions.get.mockResolvedValue(criteria('Criteria A'));
    actions.update
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(criteria('Typed while saving', ['admin', 'user']));
    const view = render(<Scenario />);
    const { user } = view;
    try {
      await user.click(screen.getByRole('button', { name: 'Edit criteria A' }));
      const name = await screen.findByRole('textbox', { name: 'Name' });
      await user.clear(name);
      await user.paste('Local name');
      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(actions.update).toHaveBeenNthCalledWith(1, {
        id: 'criteria-a',
        name: 'Local name',
        config: expect.objectContaining({ accountRoles: [AuthorizationRole.USER] }),
        observed: {
          kind: MemberCriteriaKind.FILTER,
          config: expect.objectContaining({ accountRoles: [AuthorizationRole.USER] }),
        },
      });
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      await user.clear(name);
      await user.paste('Typed while saving');
      await act(async () => {
        pending.resolve(criteria('Local name', ['admin', 'user']));
        await pending.promise;
      });
      await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
      expect(name).toHaveValue('Typed while saving');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(actions.update).toHaveBeenNthCalledWith(2, {
        id: 'criteria-a',
        name: 'Typed while saving',
        config: expect.objectContaining({ accountRoles: [AuthorizationRole.ADMIN, AuthorizationRole.USER] }),
        observed: {
          kind: MemberCriteriaKind.FILTER,
          config: expect.objectContaining({ accountRoles: [AuthorizationRole.ADMIN, AuthorizationRole.USER] }),
        },
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    } finally {
      view.unmount();
      await act(async () => {
        pending.resolve(criteria('Local name', ['admin', 'user']));
        await pending.promise;
      });
    }
  });
});

it('does not apply an estimate to a different criteria opened during the request', async () => {
  const estimate = deferred<{ count: number }>();
  actions.get.mockImplementation((id: string) =>
    Promise.resolve(criteria(id === 'criteria-a' ? 'Criteria A' : 'Criteria B')),
  );
  actions.estimate.mockReturnValueOnce(estimate.promise);
  const { user } = render(<Scenario />);
  await user.click(screen.getByRole('button', { name: 'Edit criteria A' }));
  await screen.findByRole('textbox', { name: 'Name' });
  await user.click(screen.getByRole('button', { name: 'Count matching members' }));
  await user.click(screen.getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: 'Edit criteria B' }));
  expect(await screen.findByRole('textbox', { name: 'Name' })).toHaveValue('Criteria B');
  await act(async () => estimate.resolve({ count: 999 }));
  expect(screen.queryByText(/999/)).not.toBeInTheDocument();
});
