// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
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
  mutations: [] as Array<(...args: never[]) => Promise<unknown>>,
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
vi.mock('@tanstack/react-query', () => ({
  useMutation: ({ mutationFn }: { mutationFn: (...args: never[]) => Promise<unknown> }) => {
    state.mutations.push(mutationFn);
    return { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/core/Notification', () => ({ notifications: { show: vi.fn() } }));
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

function Post({ id }: { id: string }) {
  usePostLifecycle({
    postId: id,
    initialStatus: 'draft',
    initialScheduledAt: null,
    initialScheduledTimeZone: null,
    allowedActions: [PostAction.PUBLISH_NOW, PostAction.UNPUBLISH],
    openSchedule: vi.fn(),
    closeSchedule: vi.fn(),
  });
  return null;
}
function Work({ id }: { id: string }) {
  useWorkLifecycle({ workId: id, initialStatus: 'draft', canEdit: true, isAdmin: true, onDeleted: vi.fn() });
  return null;
}
function Event({ id }: { id: string }) {
  useProgramEventLifecycle({ eventId: id, initialStatus: 'draft', allowedActions: ['publish', 'archive'] });
  return null;
}

let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  state.mutations.length = 0;
  root = createRoot(document.createElement('div'));
});
afterEach(() => act(() => root.unmount()));

describe('status metadata origins', () => {
  it('forwards schedule origin at request time with the existing schedule intent', async () => {
    const id = 'post-schedule-origin';
    const resolution: PostScheduleResolution = {
      instant: new Date('2026-10-15T00:00:00Z'),
      timeZone: 'Asia/Seoul',
      localLabel: 'Local',
      utcLabel: 'UTC',
    };
    act(() => root.render(<Post id={id} />));
    const schedule = state.mutations[3] as unknown as (value: PostScheduleResolution) => Promise<unknown>;
    await act(async () => {
      await schedule(resolution);
    });
    expect(state.postSchedule).toHaveBeenCalledExactlyOnceWith(
      id,
      resolution.instant,
      resolution.timeZone,
      getEditorWriteOrigin(),
    );
  });

  it.each([
    ['post-publish', Post, 'post', 0, state.postPublish],
    ['post-unpublish', Post, 'post', 1, state.postUnpublish],
    ['post-archive', Post, 'post', 2, state.postArchive],
    ['post-cancel', Post, 'post', 4, state.postCancel],
    ['post-republish', Post, 'post', 5, state.postRepublish],
    ['work-publish', Work, 'work', 0, state.workPublish],
    ['work-unpublish', Work, 'work', 1, state.workUnpublish],
    ['event-publish', Event, 'program_event', 1, state.eventPublish],
    ['event-archive', Event, 'program_event', 2, state.eventArchive],
  ] as const)(
    'forwards tab origin and keeps authoritative refresh enabled for %s',
    async (id, Harness, entity, index, action) => {
      const owner = Symbol('canonical-owner');
      registerConfigurationOriginWrite(`${entity}:${id}`, owner)(true);
      const origin = getEditorWriteOrigin();
      expect(hasAdoptedConfigurationOrigin(`${entity}:${id}`, owner, origin)).toBe(true);
      act(() => root.render(<Harness id={id} />));
      await act(async () => {
        await state.mutations[index]();
      });
      expect(action).toHaveBeenCalledExactlyOnceWith(id, origin);
      expect(hasAdoptedConfigurationOrigin(`${entity}:${id}`, owner, origin)).toBe(false);
    },
  );
});
