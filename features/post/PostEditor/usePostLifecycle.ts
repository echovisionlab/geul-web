'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PostAction } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { flushEditorSaves } from '@/lib/editor/editor-save-registry';
import type { StatusOption } from '@/features/editor/EditorHeader';
import {
  archivePostAction,
  cancelPostScheduleAction,
  deletePostAction,
  publishPostAction,
  republishPostAction,
  schedulePostAction,
  unpublishPostAction,
} from '@/lib/actions/post';
import type { PostStatus } from '@/lib/types/post/model';
import { getPostLifecycleStatusChoices, resolvePostLifecycleCommand } from './post-lifecycle-policy';
import type { PostScheduleResolution } from './post-schedule';

interface Options {
  postId: string;
  initialStatus: PostStatus;
  initialScheduledAt: string | null;
  initialScheduledTimeZone: string | null;
  allowedActions: readonly PostAction[];
  openSchedule: () => void;
  closeSchedule: () => void;
}

export async function runPostLifecycleActionAfterSave<T>(
  postId: string,
  lock: { current: boolean },
  action: () => Promise<T>,
  onSaveFailure: () => void,
): Promise<T | null> {
  if (lock.current) {
    return null;
  }
  lock.current = true;
  try {
    let saved = false;
    try {
      saved = await flushEditorSaves(`post:${postId}`);
    } catch {
      saved = false;
    }
    if (!saved) {
      onSaveFailure();
      return null;
    }
    return await action();
  } finally {
    lock.current = false;
  }
}

function postStatusTone(status: PostStatus): StatusOption<PostStatus>['tone'] {
  switch (status) {
    case 'published':
      return 'positive';
    case 'archived':
      return 'warning';
    case 'draft':
    case 'scheduled':
      return 'neutral';
  }
}

export function usePostLifecycle({
  postId,
  initialStatus,
  initialScheduledAt,
  initialScheduledTimeZone,
  allowedActions,
  openSchedule,
  closeSchedule,
}: Options) {
  const t = useTranslations('postEditor');
  const tCommon = useTranslations('common');
  const tCommonNotifications = useTranslations('common.notifications');
  const router = useRouter();
  const [status, setStatus] = useState<PostStatus>(initialStatus);
  const [scheduledAt, setScheduledAt] = useState<string | null>(initialScheduledAt);
  const [scheduledTimeZone, setScheduledTimeZone] = useState<string | null>(initialScheduledTimeZone);
  const lifecycleCommandInFlight = useRef(false);
  const allowed = useMemo(() => new Set(allowedActions), [allowedActions]);

  const permissions = useMemo(
    () => ({
      canEdit: allowed.has(PostAction.EDIT),
      canPublishNow: allowed.has(PostAction.PUBLISH_NOW),
      canSchedule: allowed.has(PostAction.SCHEDULE),
      canCancelSchedule: allowed.has(PostAction.CANCEL_SCHEDULE),
      canUnpublish: allowed.has(PostAction.UNPUBLISH),
      canArchive: allowed.has(PostAction.ARCHIVE),
      canRepublish: allowed.has(PostAction.REPUBLISH),
      canDelete: allowed.has(PostAction.DELETE),
      canAddAuthor: allowed.has(PostAction.ADD_AUTHOR),
      canRemoveAuthor: allowed.has(PostAction.REMOVE_AUTHOR),
      canManageCollaborators: allowed.has(PostAction.MANAGE_COLLABORATORS),
      canViewVersions: allowed.has(PostAction.VIEW_VERSIONS),
      canRestoreVersion: allowed.has(PostAction.RESTORE_VERSION),
      canManageShareLinks: allowed.has(PostAction.MANAGE_SHARE_LINKS),
    }),
    [allowed],
  );

  const reportActionError = useCallback((error?: string) => {
    if (!error) {
      return false;
    }
    notifications.show({ message: error, color: 'red' });
    return true;
  }, []);

  const runAfterEditorSave = useCallback(
    <T>(action: () => Promise<T>) =>
      runPostLifecycleActionAfterSave(postId, lifecycleCommandInFlight, action, () =>
        notifications.show({ message: tCommonNotifications('saveFailed'), color: 'red' }),
      ),
    [postId, tCommonNotifications],
  );

  const publish = useMutation({
    mutationFn: () => runAfterEditorSave(() => publishPostAction(postId)),
    onSuccess: (result) => {
      if (!result) {
        return;
      }
      if (!result.ok) {
        reportActionError(result.error);
        return;
      }
      setStatus('published');
      setScheduledAt(null);
      setScheduledTimeZone(null);
      notifications.show({ message: t('notifications.published'), color: 'green' });
      router.refresh();
    },
  });
  const unpublish = useMutation({
    mutationFn: () => runAfterEditorSave(() => unpublishPostAction(postId)),
    onSuccess: (result) => {
      if (!result) {
        return;
      }
      if (!result.ok) {
        reportActionError(result.error);
        return;
      }
      setStatus('draft');
      notifications.show({ message: t('notifications.unpublished'), color: 'yellow' });
      router.refresh();
    },
  });
  const archive = useMutation({
    mutationFn: () => runAfterEditorSave(() => archivePostAction(postId)),
    onSuccess: (result) => {
      if (!result) {
        return;
      }
      if (!result.ok) {
        reportActionError(result.error);
        return;
      }
      setStatus('archived');
      notifications.show({ message: t('notifications.archived'), color: 'orange' });
      router.refresh();
    },
  });
  const schedule = useMutation({
    mutationFn: (resolution: PostScheduleResolution) =>
      runAfterEditorSave(() => schedulePostAction(postId, resolution.instant, resolution.timeZone)),
    onSuccess: (result, resolution) => {
      if (!result) {
        return;
      }
      if (!result.ok) {
        reportActionError(result.error);
        return;
      }
      setStatus('scheduled');
      setScheduledAt(resolution.instant.toISOString());
      setScheduledTimeZone(resolution.timeZone);
      closeSchedule();
      notifications.show({ message: t('notifications.scheduled'), color: 'green' });
      router.refresh();
    },
  });
  const cancelSchedule = useMutation({
    mutationFn: () => runAfterEditorSave(() => cancelPostScheduleAction(postId)),
    onSuccess: (result) => {
      if (!result) {
        return;
      }
      if (!result.ok) {
        reportActionError(result.error);
        return;
      }
      setStatus('draft');
      setScheduledAt(null);
      setScheduledTimeZone(null);
      notifications.show({ message: t('notifications.scheduleCancelled'), color: 'yellow' });
      router.refresh();
    },
  });
  const republish = useMutation({
    mutationFn: () => runAfterEditorSave(() => republishPostAction(postId)),
    onSuccess: (result) => {
      if (!result) {
        return;
      }
      if (!result.ok) {
        reportActionError(result.error);
        return;
      }
      setStatus('published');
      notifications.show({ message: t('notifications.republished'), color: 'green' });
      router.refresh();
    },
  });
  const deletePost = useMutation({
    mutationFn: () => deletePostAction(postId),
    onSuccess: (result) => {
      if (!result.ok) {
        reportActionError(result.error);
        return;
      }
      notifications.show({ message: t('notifications.deleted'), color: 'red' });
      router.push('/my/posts');
    },
  });

  const statusOptions = useMemo<StatusOption<PostStatus>[]>(() => {
    return getPostLifecycleStatusChoices(status, allowed).map(({ status: targetStatus, command }) => {
      let actionLabel: string;
      switch (command) {
        case null:
          actionLabel = tCommon(`statuses.${targetStatus}`);
          break;
        case 'publish':
          actionLabel = tCommon('actions.publish');
          break;
        case 'unpublish':
          actionLabel = tCommon('actions.unpublish');
          break;
        case 'archive':
          actionLabel = t('statusActions.archive');
          break;
        case 'openSchedule':
          actionLabel = t('statusActions.schedule');
          break;
        case 'cancelSchedule':
          actionLabel = t('statusActions.cancelSchedule');
          break;
        case 'republish':
          actionLabel = t('statusActions.republish');
          break;
      }

      return {
        value: targetStatus,
        label: tCommon(`statuses.${targetStatus}`),
        actionLabel,
        tone: postStatusTone(targetStatus),
      };
    });
  }, [allowed, status, t, tCommon]);

  const changeStatus = useCallback(
    (nextStatus: PostStatus) => {
      const command = resolvePostLifecycleCommand(status, nextStatus, allowed);
      switch (command) {
        case 'publish':
          publish.mutate();
          break;
        case 'unpublish':
          unpublish.mutate();
          break;
        case 'archive':
          archive.mutate();
          break;
        case 'openSchedule':
          openSchedule();
          break;
        case 'cancelSchedule':
          cancelSchedule.mutate();
          break;
        case 'republish':
          republish.mutate();
          break;
        case null:
          break;
      }
    },
    [allowed, archive, cancelSchedule, openSchedule, publish, republish, status, unpublish],
  );

  return {
    status,
    scheduledAt,
    scheduledTimeZone,
    permissions,
    statusOptions,
    changeStatus,
    schedule,
    deletePost,
    isChanging: [publish, unpublish, archive, schedule, cancelSchedule, republish].some(
      (mutation) => mutation.isPending,
    ),
  };
}
