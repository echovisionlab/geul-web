import { PostAction } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import { describe, expect, it } from 'vitest';
import { getPostLifecycleStatusChoices, resolvePostLifecycleCommand } from './post-lifecycle-policy';

const actionSet = (...actions: PostAction[]) => new Set(actions);

describe('post lifecycle policy', () => {
  it.each([
    {
      name: 'republishes an archived post when republish is allowed',
      current: 'archived',
      target: 'published',
      actions: [PostAction.REPUBLISH, PostAction.PUBLISH_NOW],
      command: 'republish',
    },
    {
      name: 'publishes an archived post when only publish-now is allowed',
      current: 'archived',
      target: 'published',
      actions: [PostAction.PUBLISH_NOW],
      command: 'publish',
    },
    {
      name: 'cancels a scheduled post when returning it to draft',
      current: 'scheduled',
      target: 'draft',
      actions: [PostAction.CANCEL_SCHEDULE, PostAction.UNPUBLISH],
      command: 'cancelSchedule',
    },
    {
      name: 'falls back to unpublish when schedule cancellation is unavailable',
      current: 'scheduled',
      target: 'draft',
      actions: [PostAction.UNPUBLISH],
      command: 'unpublish',
    },
    {
      name: 'opens the scheduling modal for the scheduled target',
      current: 'draft',
      target: 'scheduled',
      actions: [PostAction.SCHEDULE],
      command: 'openSchedule',
    },
    {
      name: 'archives when the archive target is selected',
      current: 'published',
      target: 'archived',
      actions: [PostAction.ARCHIVE],
      command: 'archive',
    },
  ] as const)('$name', ({ current, target, actions, command }) => {
    expect(resolvePostLifecycleCommand(current, target, actionSet(...actions))).toBe(command);
  });

  it('treats the current status as a no-op', () => {
    expect(resolvePostLifecycleCommand('scheduled', 'scheduled', actionSet(PostAction.SCHEDULE))).toBeNull();
  });

  it('does not expose actions when their matching permission is absent', () => {
    expect(resolvePostLifecycleCommand('draft', 'published', actionSet(PostAction.REPUBLISH))).toBeNull();
    expect(resolvePostLifecycleCommand('draft', 'scheduled', actionSet(PostAction.PUBLISH_NOW))).toBeNull();
    expect(resolvePostLifecycleCommand('draft', 'archived', actionSet(PostAction.DELETE))).toBeNull();
  });

  it('keeps the current choice and includes only transitions with an allowed command', () => {
    expect(getPostLifecycleStatusChoices('draft', actionSet(PostAction.REPUBLISH, PostAction.SCHEDULE))).toEqual([
      { status: 'draft', command: null },
      { status: 'scheduled', command: 'openSchedule' },
    ]);
  });
});
