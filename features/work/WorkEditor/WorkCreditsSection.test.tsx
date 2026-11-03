// @vitest-environment jsdom

import type { PropsWithChildren } from 'react';
import { act, render as renderUI, screen, waitFor } from '@/test/render';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DragEndEvent } from '@dnd-kit/core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getWorkGroupsWithCreditsAction, moveWorkCreditItemAction } from '@/lib/actions/work';
import { WorkCreditsSection } from './WorkCreditsSection';

const interaction = vi.hoisted(() => ({ onDragEnd: null as null | ((event: DragEndEvent) => void) }));
vi.mock('@/lib/actions/work', () => ({
  getWorkGroupsWithCreditsAction: vi.fn(),
  moveWorkCreditItemAction: vi.fn(),
  addWorkCreditAction: vi.fn(),
  createWorkCreditGroupAction: vi.fn(),
  deleteWorkCreditGroupAction: vi.fn(),
  removeWorkCreditAction: vi.fn(),
  searchArtistsForCreditAction: vi.fn(),
  updateWorkCreditAction: vi.fn(),
  updateWorkCreditGroupAction: vi.fn(),
}));
vi.mock('@/lib/queries/user-browser', () => ({ searchMembers: vi.fn() }));
vi.mock('@/lib/editor/editor-entity-changes', () => ({
  publishEditorEntityChange: vi.fn(),
  useEditorEntityChanges: vi.fn(),
}));
vi.mock('@/lib/hooks/useSortableSensors', () => ({ useSortableSensors: () => [] }));
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: PropsWithChildren<{ onDragEnd: (event: DragEndEvent) => void }>) => {
    interaction.onDragEnd = onDragEnd;
    return children;
  },
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  closestCenter: vi.fn(),
  pointerWithin: vi.fn(),
  getFirstCollision: vi.fn(),
}));
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: PropsWithChildren) => children,
  verticalListSortingStrategy: vi.fn(),
}));
vi.mock('./credits/SortableCreditGroupHeader', () => ({
  SortableCreditGroupHeader: ({ group }: { group: { id: string; name: string } }) => <h3>{group.name}</h3>,
}));
vi.mock('./credits/SortableCreditRow', () => ({
  SortableCreditRow: ({ credit, groupId }: { credit: { id: string }; groupId: string | null }) => (
    <div role="group" aria-label={`Credit ${credit.id} in ${groupId ?? 'none'}`} />
  ),
}));
vi.mock('@/lib/contexts/WorkMetaContext', async () => {
  const { useState, useCallback } = await import('react');
  return {
    useWorkMeta: () => {
      const [creditOrder, setCreditOrder] = useState([]);
      const [creditsVersion, setVersion] = useState(0);
      const incrementCreditsVersion = useCallback(() => setVersion((version) => version + 1), []);
      return { creditOrder, setCreditOrder, creditsVersion, incrementCreditsVersion };
    },
  };
});

let queryClient: QueryClient;
const initial = {
  groups: [
    { id: 'a', workId: 'work-1', name: 'Group A', sortOrder: 0 },
    { id: 'b', workId: 'work-1', name: 'Group B', sortOrder: 1 },
  ],
  credits: [],
  order: [
    { type: 'group' as const, id: 'a' },
    { type: 'group' as const, id: 'b' },
  ],
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
function order() {
  return screen.getAllByRole('heading', { level: 3 }).map((group) => (group.textContent === 'Group A' ? 'a' : 'b'));
}
function editor(canEdit = true) {
  return (
    <QueryClientProvider client={queryClient}>
      <WorkCreditsSection workId="work-1" canEdit={canEdit} />
    </QueryClientProvider>
  );
}
function moveAAfterB() {
  interaction.onDragEnd?.({
    active: { id: 'group-a', data: { current: { type: 'group', groupId: 'a' } } },
    over: { id: 'group-b', data: { current: { type: 'group', groupId: 'b' } } },
  } as unknown as DragEndEvent);
}
beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  queryClient.clear();
});

it('retains the canonical moved order when an earlier credits refetch completes after the save', async () => {
  const olderRead = deferred<typeof initial>();
  const move = deferred<Awaited<ReturnType<typeof moveWorkCreditItemAction>>>();
  vi.mocked(getWorkGroupsWithCreditsAction).mockResolvedValueOnce(initial).mockReturnValueOnce(olderRead.promise);
  vi.mocked(moveWorkCreditItemAction).mockReturnValueOnce(move.promise);
  renderUI(editor());
  await screen.findByText('Group A');
  expect(order()).toEqual(['a', 'b']);
  let refetch!: Promise<unknown>;
  act(() => {
    refetch = queryClient.refetchQueries({ queryKey: ['work', 'groupsWithCredits', 'work-1'] });
  });
  act(moveAAfterB);
  await waitFor(() => expect(order()).toEqual(['b', 'a']));
  await act(async () =>
    move.resolve({
      ok: true,
      success: true,
      order: [
        { kind: 'group', id: 'b' },
        { kind: 'group', id: 'a' },
      ],
    }),
  );
  await act(async () => {
    olderRead.resolve(initial);
    await refetch;
  });
  await waitFor(() => expect(order()).toEqual(['b', 'a']));
  expect(moveWorkCreditItemAction).toHaveBeenCalledWith(
    'work-1',
    expect.objectContaining({ itemId: 'a' }),
    expect.any(String),
  );
});

it('reloads the confirmed order after a failed move and allows another move', async () => {
  vi.mocked(getWorkGroupsWithCreditsAction).mockResolvedValue(initial);
  vi.mocked(moveWorkCreditItemAction)
    .mockResolvedValueOnce({ ok: false, error: 'offline', errorCode: 'ACTION_FAILED' })
    .mockResolvedValueOnce({
      ok: true,
      success: true,
      order: [
        { kind: 'group', id: 'b' },
        { kind: 'group', id: 'a' },
      ],
    });
  renderUI(editor());
  await screen.findByText('Group A');
  act(moveAAfterB);
  await waitFor(() => expect(getWorkGroupsWithCreditsAction).toHaveBeenCalledTimes(2));
  expect(order()).toEqual(['a', 'b']);
  act(moveAAfterB);
  await waitFor(() => expect(moveWorkCreditItemAction).toHaveBeenCalledTimes(2));
});

it('keeps canonical peer group assignments when the next local move adds an override', async () => {
  const first = deferred<Awaited<ReturnType<typeof moveWorkCreditItemAction>>>();
  const second = deferred<Awaited<ReturnType<typeof moveWorkCreditItemAction>>>();
  const peerRead = deferred<Awaited<ReturnType<typeof getWorkGroupsWithCreditsAction>>>();
  const credits = ['c', 'd'].map((id, sortOrder) => ({
    id,
    groupId: 'a',
    name: id,
    creditRole: null,
    sortOrder,
    artist: null,
    member: null,
  }));
  vi.mocked(getWorkGroupsWithCreditsAction)
    .mockResolvedValueOnce({
      groups: [...initial.groups, { id: 'peer', workId: 'work-1', name: 'Peer group', sortOrder: 2 }],
      credits,
      order: [
        { type: 'group', id: 'a' },
        { type: 'credit', id: 'c', creditType: 'name' },
        { type: 'credit', id: 'd', creditType: 'name' },
        { type: 'group', id: 'b' },
        { type: 'group', id: 'peer' },
      ],
    })
    .mockReturnValue(peerRead.promise);
  vi.mocked(moveWorkCreditItemAction).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  renderUI(editor());
  await screen.findByText('Group A');
  const moveCredit = (creditId: string) =>
    interaction.onDragEnd?.({
      active: { id: `credit-${creditId}`, data: { current: { type: 'credit', creditId, groupId: 'a' } } },
      over: { id: 'group-b', data: { current: { type: 'group', groupId: 'b' } } },
    } as unknown as DragEndEvent);
  act(() => moveCredit('c'));
  await act(async () =>
    first.resolve({
      ok: true,
      success: true,
      order: [
        { kind: 'group', id: 'a' },
        { kind: 'credit', id: 'd', groupId: 'a' },
        { kind: 'group', id: 'b' },
        { kind: 'group', id: 'peer' },
        { kind: 'credit', id: 'c', groupId: 'peer' },
      ],
    }),
  );
  expect(await screen.findByRole('group', { name: 'Credit c in peer' })).toBeVisible();
  act(() => moveCredit('d'));
  expect(await screen.findByRole('group', { name: 'Credit c in peer' })).toBeVisible();
  expect(await screen.findByRole('group', { name: 'Credit d in b' })).toBeVisible();
});

it('upgrades and downgrades credits on the same mounted rows and save coordinator', async () => {
  vi.mocked(getWorkGroupsWithCreditsAction).mockResolvedValue(initial);
  vi.mocked(moveWorkCreditItemAction)
    .mockReset()
    .mockResolvedValue({
      ok: true,
      success: true,
      order: [
        { kind: 'group', id: 'b' },
        { kind: 'group', id: 'a' },
      ],
    });
  const { rerender } = renderUI(editor(false));
  const group = await screen.findByText('Group A');
  act(moveAAfterB);
  expect(moveWorkCreditItemAction).not.toHaveBeenCalled();
  rerender(editor(true));
  expect(screen.getByText('Group A')).toBe(group);
  expect(screen.getByText('Group A')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
  act(moveAAfterB);
  await waitFor(() => expect(moveWorkCreditItemAction).toHaveBeenCalledOnce());
  rerender(editor(false));
  act(moveAAfterB);
  await waitFor(() => expect(moveWorkCreditItemAction).toHaveBeenCalledOnce());
  expect(screen.getByText('Group A')).toBe(group);
});

it.each(['returned', 'rejected'])(
  'shows a %s credits read failure instead of an empty list and can retry',
  async (failure) => {
    let finish!: (result: Awaited<ReturnType<typeof getWorkGroupsWithCreditsAction>>) => void;
    let fail!: (reason: Error) => void;
    vi.mocked(getWorkGroupsWithCreditsAction)
      .mockReset()
      .mockReturnValueOnce(
        new Promise((resolve, reject) => {
          finish = resolve;
          fail = reject;
        }),
      )
      .mockResolvedValue(initial);
    const { user } = renderUI(editor());
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.queryByText('No credits yet')).not.toBeInTheDocument();
    await act(async () => {
      if (failure === 'returned') {
        finish({ groups: [], credits: [], order: [], error: true });
      } else {
        fail(new Error('offline'));
      }
    });
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByRole('status', { name: 'Loading...' })).not.toBeInTheDocument();
    expect(screen.queryByText('No credits yet')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Group A')).toBeVisible();
  },
);
