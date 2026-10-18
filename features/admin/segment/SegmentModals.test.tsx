// @vitest-environment jsdom

import { act, render, screen, waitFor, within } from '@/test/render';
import { SegmentType } from '@echovisionlab/geul-proto/secure/audience_pb.ts';
import { AuthorizationRole } from '@echovisionlab/geul-proto/policy/access_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SegmentModals } from './SegmentModals';
import { SegmentModalProvider, useSegmentModal } from './SegmentModalContext';

const actions = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/actions/audience', () => ({
  archiveSegmentAction: vi.fn(),
  createSegmentAction: vi.fn(),
  estimateSegmentCountAction: vi.fn(),
  getSegmentAction: actions.get,
  restoreSegmentAction: vi.fn(),
  updateSegmentAction: actions.update,
}));

function Controls() {
  const { openEdit } = useSegmentModal();
  return (
    <>
      <button type="button" onClick={() => openEdit('segment-a')}>
        Edit segment A
      </button>
      <button type="button" onClick={() => openEdit('segment-b')}>
        Edit segment B
      </button>
    </>
  );
}

function Scenario() {
  return (
    <SegmentModalProvider>
      <Controls />
      <SegmentModals refresh={() => {}} />
    </SegmentModalProvider>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function segment(name: string, accountRoles: string[] = ['user']) {
  return {
    data: {
      id: 'segment-a',
      name,
      description: 'A description',
      segmentType: SegmentType.MEMBERS_BY_FILTER,
      config: { memberTagIds: [], accountRoles, createdAfter: undefined, createdBefore: undefined },
      estimatedCount: 20,
      archivedAt: null,
    },
  };
}

beforeEach(() => {
  actions.get.mockReset();
  actions.update.mockReset();
});

describe('SegmentModals edit lifecycle', () => {
  it('ignores a stale load after closing one segment and opening another', async () => {
    const segmentA = deferred<ReturnType<typeof segment>>();
    const segmentB = deferred<ReturnType<typeof segment>>();
    actions.get.mockImplementation((id: string) => (id === 'segment-a' ? segmentA.promise : segmentB.promise));
    const { user } = render(<Scenario />);
    await user.click(screen.getByRole('button', { name: 'Edit segment A' }));
    let dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit segment B' }));
    await act(async () => {
      segmentB.resolve(segment('Segment B'));
      await segmentB.promise;
    });
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Segment B');
    await act(async () => {
      segmentA.resolve(segment('Segment A'));
      await segmentA.promise;
    });
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Segment B');
  });

  it('sends touched scalar fields and keeps typing over the canonical save response', async () => {
    const pending = deferred<ReturnType<typeof segment>>();
    actions.get.mockResolvedValue(segment('Segment A'));
    actions.update
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(segment('Typed while saving', ['admin', 'user']));
    const { user } = render(<Scenario />);
    await user.click(screen.getByRole('button', { name: 'Edit segment A' }));
    const name = await screen.findByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Local name');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(actions.update).toHaveBeenNthCalledWith(1, {
      id: 'segment-a',
      name: 'Local name',
      config: expect.objectContaining({ accountRoles: [AuthorizationRole.USER] }),
      observed: {
        segmentType: SegmentType.MEMBERS_BY_FILTER,
        config: expect.objectContaining({ accountRoles: [AuthorizationRole.USER] }),
      },
    });
    await user.clear(name);
    await user.type(name, 'Typed while saving');
    await act(async () => {
      pending.resolve(segment('Local name', ['admin', 'user']));
      await pending.promise;
    });
    expect(name).toHaveValue('Typed while saving');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(actions.update).toHaveBeenNthCalledWith(2, {
      id: 'segment-a',
      name: 'Typed while saving',
      config: expect.objectContaining({ accountRoles: [AuthorizationRole.ADMIN, AuthorizationRole.USER] }),
      observed: {
        segmentType: SegmentType.MEMBERS_BY_FILTER,
        config: expect.objectContaining({ accountRoles: [AuthorizationRole.ADMIN, AuthorizationRole.USER] }),
      },
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
