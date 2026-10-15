// @vitest-environment jsdom

import { act, type PropsWithChildren } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DragEndEvent } from '@dnd-kit/core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
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
vi.mock('@/components/core/Notification', () => ({ notifications: { show: vi.fn() } }));
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
  SortableCreditGroupHeader: ({ group }: { group: { id: string; name: string } }) => (
    <div data-group={group.id}>{group.name}</div>
  ),
}));
vi.mock('./credits/SortableCreditRow', () => ({
  SortableCreditRow: ({ credit, groupId }: { credit: { id: string }; groupId: string | null }) => (
    <div data-credit={credit.id} data-parent={groupId ?? ''} />
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

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;
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
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
function order() {
  return [...host.querySelectorAll('[data-group]')].map((group) => group.getAttribute('data-group'));
}
function moveAAfterB() {
  interaction.onDragEnd?.({
    active: { id: 'group-a', data: { current: { type: 'group', groupId: 'a' } } },
    over: { id: 'group-b', data: { current: { type: 'group', groupId: 'b' } } },
  } as unknown as DragEndEvent);
}
beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  act(() => root.unmount());
  queryClient.clear();
  host.remove();
});

it('retains the canonical moved order when an earlier credits refetch completes after the save', async () => {
  const olderRead = deferred<typeof initial>();
  const move = deferred<Awaited<ReturnType<typeof moveWorkCreditItemAction>>>();
  vi.mocked(getWorkGroupsWithCreditsAction).mockResolvedValueOnce(initial).mockReturnValueOnce(olderRead.promise);
  vi.mocked(moveWorkCreditItemAction).mockReturnValueOnce(move.promise);
  act(() =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <TestProviders>
          <WorkCreditsSection workId="work-1" canEdit />
        </TestProviders>
      </QueryClientProvider>,
    ),
  );
  await settle();
  await settle();
  expect(order()).toEqual(['a', 'b']);
  let refetch!: Promise<unknown>;
  act(() => {
    refetch = queryClient.refetchQueries({ queryKey: ['work', 'groupsWithCredits', 'work-1'] });
  });
  await settle();
  act(moveAAfterB);
  await settle();
  expect(order()).toEqual(['b', 'a']);
  await act(async () =>
    move.resolve({
      success: true,
      order: [
        { kind: 'group', id: 'b' },
        { kind: 'group', id: 'a' },
      ],
    }),
  );
  await settle();
  await act(async () => {
    olderRead.resolve(initial);
    await refetch;
  });
  await settle();
  expect(order()).toEqual(['b', 'a']);
  expect(moveWorkCreditItemAction).toHaveBeenCalledWith(
    'work-1',
    expect.objectContaining({ itemId: 'a' }),
    expect.any(String),
  );
});

it('reloads the confirmed order after a failed move and allows another move', async () => {
  vi.mocked(getWorkGroupsWithCreditsAction).mockResolvedValue(initial);
  vi.mocked(moveWorkCreditItemAction)
    .mockResolvedValueOnce({ error: 'offline' })
    .mockResolvedValueOnce({
      success: true,
      order: [
        { kind: 'group', id: 'b' },
        { kind: 'group', id: 'a' },
      ],
    });
  act(() =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <TestProviders>
          <WorkCreditsSection workId="work-1" canEdit />
        </TestProviders>
      </QueryClientProvider>,
    ),
  );
  await settle();
  await settle();
  act(moveAAfterB);
  await settle();
  await settle();
  expect(order()).toEqual(['a', 'b']);
  act(moveAAfterB);
  await settle();
  expect(moveWorkCreditItemAction).toHaveBeenCalledTimes(2);
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
  act(() =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <TestProviders>
          <WorkCreditsSection workId="work-1" canEdit />
        </TestProviders>
      </QueryClientProvider>,
    ),
  );
  await settle();
  await settle();
  const moveCredit = (creditId: string) =>
    interaction.onDragEnd?.({
      active: { id: `credit-${creditId}`, data: { current: { type: 'credit', creditId, groupId: 'a' } } },
      over: { id: 'group-b', data: { current: { type: 'group', groupId: 'b' } } },
    } as unknown as DragEndEvent);
  act(() => moveCredit('c'));
  await settle();
  await act(async () =>
    first.resolve({
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
  await settle();
  expect(host.querySelector('[data-credit="c"]')?.getAttribute('data-parent')).toBe('peer');
  act(() => moveCredit('d'));
  await settle();
  expect(host.querySelector('[data-credit="c"]')?.getAttribute('data-parent')).toBe('peer');
  expect(host.querySelector('[data-credit="d"]')?.getAttribute('data-parent')).toBe('b');
});

it('upgrades and downgrades credits on the same mounted rows and save coordinator', async () => {
  vi.mocked(getWorkGroupsWithCreditsAction).mockResolvedValue(initial);
  vi.mocked(moveWorkCreditItemAction)
    .mockReset()
    .mockResolvedValue({
      success: true,
      order: [
        { kind: 'group', id: 'b' },
        { kind: 'group', id: 'a' },
      ],
    });
  const render = (canEdit: boolean) =>
    act(() =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestProviders>
            <WorkCreditsSection workId="work-1" canEdit={canEdit} />
          </TestProviders>
        </QueryClientProvider>,
      ),
    );
  render(false);
  await settle();
  await settle();
  const group = host.querySelector('[data-group="a"]');
  expect(group).not.toBeNull();
  act(moveAAfterB);
  expect(moveWorkCreditItemAction).not.toHaveBeenCalled();
  render(true);
  expect(host.querySelector('[data-group="a"]')).toBe(group);
  expect(host.textContent).toContain('Group A');
  expect(host.querySelectorAll('button').length).toBeGreaterThan(0);
  act(moveAAfterB);
  await settle();
  expect(moveWorkCreditItemAction).toHaveBeenCalledOnce();
  render(false);
  act(moveAAfterB);
  expect(moveWorkCreditItemAction).toHaveBeenCalledOnce();
  expect(host.querySelector('[data-group="a"]')).toBe(group);
});
