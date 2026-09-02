'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { deleteWorkAction, publishWorkAction, unpublishWorkAction } from '@/lib/actions/work';
import { resolveWorkLifecycleControls, type WorkEditorStatus } from './work-lifecycle-controls';

interface Options {
  workId: string;
  initialStatus: string;
  canEdit: boolean;
  isAdmin: boolean;
  onDeleted: () => void;
}

function normalizeStatus(status: string): WorkEditorStatus {
  return status === 'published' ? 'published' : status === 'archived' ? 'archived' : 'draft';
}

export function useWorkLifecycle({ workId, initialStatus, canEdit, isAdmin, onDeleted }: Options) {
  const t = useTranslations('workEditor');
  const tCommon = useTranslations('common');
  const [status, setStatus] = useState<WorkEditorStatus>(() => normalizeStatus(initialStatus));

  const publish = useMutation({
    mutationFn: () => publishWorkAction(workId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      const reloadAfterPublish = status === 'archived';
      setStatus('published');
      notifications.show({ message: t('notifications.published'), color: 'green' });
      if (reloadAfterPublish) {
        window.location.reload();
      }
    },
  });

  const unpublish = useMutation({
    mutationFn: () => unpublishWorkAction(workId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      setStatus('draft');
      notifications.show({ message: t('notifications.unpublished'), color: 'yellow' });
    },
  });

  const deleteWork = useMutation({
    mutationFn: () => deleteWorkAction(workId),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: t('notifications.deleted'), color: 'red' });
      onDeleted();
    },
  });

  const controls = useMemo(
    () =>
      resolveWorkLifecycleControls(status, isAdmin, {
        draft: tCommon('statuses.draft'),
        published: tCommon('statuses.published'),
        archived: tCommon('statuses.archived'),
        publish: tCommon('actions.publish'),
        unpublish: tCommon('actions.unpublish'),
      }),
    [isAdmin, status, tCommon],
  );

  const changeStatus = useCallback(
    (nextStatus: WorkEditorStatus) => {
      if (nextStatus === 'published') {
        publish.mutate();
      } else if (nextStatus === 'draft') {
        unpublish.mutate();
      }
    },
    [publish, unpublish],
  );

  return {
    status,
    canEdit,
    controls,
    changeStatus,
    deleteWork,
    isChanging: publish.isPending || unpublish.isPending,
  };
}
