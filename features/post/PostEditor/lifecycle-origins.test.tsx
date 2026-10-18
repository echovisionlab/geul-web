// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TestProviders } from '@/test/TestProviders';
import { act, renderHook, waitFor } from '@/test/render';
import { notifications } from '@/components/core/Notification';
import type { PostStatus } from '@/lib/types/post/model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostAction } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import {
  getEditorWriteOrigin,
  hasAdoptedConfigurationOrigin,
  registerConfigurationOriginWrite,
} from '@/lib/editor/editor-write-origin';
import { useProgramEventLifecycle } from '@/features/program-event/ProgramEventEditor/useProgramEventLifecycle';
import { useWorkLifecycle } from '@/features/work/WorkEditor/useWorkLifecycle';
import { usePostLifecycle } from './usePostLifecycle';
import type { PostScheduleResolution } from './post-schedule';

const state = vi.hoisted(() => ({
  postPublish: vi.fn(),
  postUnpublish: vi.fn(),
  postArchive: vi.fn(),
  postSchedule: vi.fn(),
  postCancel: vi.fn(),
  postRepublish: vi.fn(),
  workPublish: vi.fn(),
  workUnpublish: vi.fn(),
  eventPublish: vi.fn(),
  eventArchive: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/actions/post', () => ({
  publishPostAction: state.postPublish,
  unpublishPostAction: state.postUnpublish,
  archivePostAction: state.postArchive,
  schedulePostAction: state.postSchedule,
  cancelPostScheduleAction: state.postCancel,
  republishPostAction: state.postRepublish,
  deletePostAction: vi.fn(),
}));
vi.mock('@/lib/actions/work', () => ({
  publishWorkAction: state.workPublish,
  unpublishWorkAction: state.workUnpublish,
  deleteWorkAction: vi.fn(),
}));
vi.mock('@/lib/actions/program-event', () => ({
  publishProgramEventAction: state.eventPublish,
  archiveProgramEventAction: state.eventArchive,
  deleteProgramEventAction: vi.fn(),
  updateProgramEventAction: vi.fn(),
}));

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return (
    <TestProviders>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </TestProviders>
  );
}
function usePost(id: string, initialStatus: PostStatus = 'draft') {
  return usePostLifecycle({
    postId: id,
    initialStatus,
    initialScheduledAt: null,
    initialScheduledTimeZone: null,
    allowedActions: [
      PostAction.PUBLISH_NOW,
      PostAction.UNPUBLISH,
      PostAction.ARCHIVE,
      PostAction.CANCEL_SCHEDULE,
      PostAction.REPUBLISH,
      PostAction.SCHEDULE,
    ],
    openSchedule: vi.fn(),
    closeSchedule: vi.fn(),
  });
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  Object.values(state).forEach((action) => action.mockReset().mockResolvedValue({ success: true }));
});
afterEach(() => {
  client.clear();
  act(() => notifications.clean());
});

describe('status metadata origins', () => {
  it('forwards schedule origin at request time with the existing schedule intent', async () => {
    const id = 'post-schedule-origin';
    const resolution: PostScheduleResolution = {
      instant: new Date('2026-10-15T00:00:00Z'),
      timeZone: 'Asia/Seoul',
      localLabel: 'Local',
      utcLabel: 'UTC',
    };
    const { result } = renderHook(() => usePost(id), { wrapper });
    await act(async () => {
      await result.current.schedule.mutateAsync(resolution);
    });
    expect(state.postSchedule).toHaveBeenCalledExactlyOnceWith(
      id,
      resolution.instant,
      resolution.timeZone,
      getEditorWriteOrigin(),
    );
  });

  it.each([
    ['post-publish', 'draft', 'published', state.postPublish],
    ['post-unpublish', 'published', 'draft', state.postUnpublish],
    ['post-archive', 'published', 'archived', state.postArchive],
    ['post-cancel', 'scheduled', 'draft', state.postCancel],
    ['post-republish', 'archived', 'published', state.postRepublish],
  ] as const)('forwards tab origin and releases authoritative refresh for %s', async (id, initial, next, action) => {
    const owner = Symbol('canonical-owner');
    registerConfigurationOriginWrite(`post:${id}`, owner)(true);
    const origin = getEditorWriteOrigin();
    expect(hasAdoptedConfigurationOrigin(`post:${id}`, owner, origin)).toBe(true);
    const { result } = renderHook(() => usePost(id, initial), { wrapper });
    act(() => result.current.changeStatus(next));
    await waitFor(() => expect(action).toHaveBeenCalledExactlyOnceWith(id, origin));
    expect(hasAdoptedConfigurationOrigin(`post:${id}`, owner, origin)).toBe(false);
  });

  it.each([
    ['work-publish', 'work', 'published', state.workPublish],
    ['work-unpublish', 'work', 'draft', state.workUnpublish],
    ['event-publish', 'program_event', 'published', state.eventPublish],
    ['event-archive', 'program_event', 'archived', state.eventArchive],
  ] as const)('forwards tab origin and releases authoritative refresh for %s', async (id, entity, next, action) => {
    const owner = Symbol('canonical-owner');
    registerConfigurationOriginWrite(`${entity}:${id}`, owner)(true);
    const origin = getEditorWriteOrigin();
    expect(hasAdoptedConfigurationOrigin(`${entity}:${id}`, owner, origin)).toBe(true);
    function useLifecycle() {
      const work = useWorkLifecycle({
        workId: id,
        initialStatus: 'draft',
        canEdit: true,
        isAdmin: true,
        onDeleted: vi.fn(),
      });
      const event = useProgramEventLifecycle({
        eventId: id,
        initialStatus: 'draft',
        allowedActions: ['publish', 'archive'],
      });
      return entity === 'work' ? work : event;
    }
    const { result } = renderHook(useLifecycle, { wrapper });
    act(() => result.current.changeStatus(next));
    await waitFor(() => expect(action).toHaveBeenCalledExactlyOnceWith(id, origin));
    expect(hasAdoptedConfigurationOrigin(`${entity}:${id}`, owner, origin)).toBe(false);
  });
});
