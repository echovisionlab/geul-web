import { PostAction } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import type { PostStatus } from '@/lib/types/post/model';

export type PostLifecycleCommand =
  'publish' | 'unpublish' | 'archive' | 'openSchedule' | 'cancelSchedule' | 'republish';

export interface PostLifecycleStatusChoice {
  status: PostStatus;
  command: PostLifecycleCommand | null;
}

export function resolvePostLifecycleCommand(
  currentStatus: PostStatus,
  targetStatus: PostStatus,
  allowedActions: ReadonlySet<PostAction>,
): PostLifecycleCommand | null {
  if (currentStatus === targetStatus) {
    return null;
  }

  switch (targetStatus) {
    case 'draft':
      if (currentStatus === 'scheduled' && allowedActions.has(PostAction.CANCEL_SCHEDULE)) {
        return 'cancelSchedule';
      }
      return allowedActions.has(PostAction.UNPUBLISH) ? 'unpublish' : null;
    case 'published':
      if (currentStatus === 'archived' && allowedActions.has(PostAction.REPUBLISH)) {
        return 'republish';
      }
      return allowedActions.has(PostAction.PUBLISH_NOW) ? 'publish' : null;
    case 'scheduled':
      return allowedActions.has(PostAction.SCHEDULE) ? 'openSchedule' : null;
    case 'archived':
      return allowedActions.has(PostAction.ARCHIVE) ? 'archive' : null;
  }
}

export function getPostLifecycleStatusChoices(
  currentStatus: PostStatus,
  allowedActions: ReadonlySet<PostAction>,
): PostLifecycleStatusChoice[] {
  const targetStatuses: PostStatus[] = ['draft', 'published', 'scheduled', 'archived'];
  const choices: PostLifecycleStatusChoice[] = [{ status: currentStatus, command: null }];

  for (const status of targetStatuses) {
    const command = resolvePostLifecycleCommand(currentStatus, status, allowedActions);
    if (command) {
      choices.push({ status, command });
    }
  }

  return choices;
}
