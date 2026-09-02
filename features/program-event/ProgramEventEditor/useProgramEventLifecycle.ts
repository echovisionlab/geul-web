'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import type { StatusOption } from '@/features/editor/EditorHeader';
import {
  archiveProgramEventAction,
  deleteProgramEventAction,
  publishProgramEventAction,
  updateProgramEventAction,
} from '@/lib/actions/program-event';
import type { ProgramEventEditorAction } from './program-event-actions';

export type ProgramEventStatusValue = 'draft' | 'published' | 'archived';
export type ProgramEventUpdate = Parameters<typeof updateProgramEventAction>[1];

interface Options {
  eventId: string;
  initialStatus: ProgramEventStatusValue;
  allowedActions: readonly ProgramEventEditorAction[];
}

export function useProgramEventLifecycle({ eventId, initialStatus, allowedActions }: Options) {
  const router = useRouter();
  const tCommon = useTranslations('common');
  const tCommonEntities = useTranslations('common.entities');
  const [status, setStatus] = useState(initialStatus);
  const allowed = useMemo(() => new Set(allowedActions), [allowedActions]);
  const canEdit = allowed.has('edit');
  const canPublish = allowed.has('publish');
  const canArchive = allowed.has('archive');
  const canDelete = allowed.has('delete');
  const update = useMutation({
    mutationFn: (data: ProgramEventUpdate) => updateProgramEventAction(eventId, data),
    onSuccess: (result) => {
      if ('error' in result && result.error) {
        notifications.show({ message: result.error, color: 'red' });
      }
    },
  });

  const mutateEditableEvent = useCallback(
    (data: ProgramEventUpdate) => {
      if (canEdit) {
        update.mutate(data);
      }
    },
    [canEdit, update],
  );
  const isEditable = useCallback(() => canEdit, [canEdit]);

  const publish = useMutation({
    mutationFn: () => publishProgramEventAction(eventId),
    onSuccess: (result) => {
      if ('error' in result && result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      setStatus('published');
      notifications.show({
        message: tCommon('messages.itemPublished', {
          item: tCommonEntities('programEvent').toLowerCase(),
        }),
        color: 'green',
      });
    },
  });

  const archive = useMutation({
    mutationFn: () => archiveProgramEventAction(eventId),
    onSuccess: (result) => {
      if ('error' in result && result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      setStatus('archived');
      notifications.show({ message: tCommon('statuses.archived'), color: 'orange' });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: () => deleteProgramEventAction(eventId),
    onSuccess: (result) => {
      if ('error' in result && result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      router.push('/admin/events');
    },
  });

  const statusOptions = useMemo<StatusOption<ProgramEventStatusValue>[]>(() => {
    if (status === 'archived') {
      return [
        {
          value: 'archived',
          label: tCommon('statuses.archived'),
          actionLabel: tCommon('statuses.archived'),
          tone: 'warning',
        },
        ...(canPublish
          ? [
              {
                value: 'published',
                label: tCommon('statuses.published'),
                actionLabel: tCommon('actions.publish'),
                tone: 'positive',
              } satisfies StatusOption<ProgramEventStatusValue>,
            ]
          : []),
      ];
    }
    if (status === 'published') {
      return [
        {
          value: 'published',
          label: tCommon('statuses.published'),
          actionLabel: tCommon('statuses.published'),
          tone: 'positive',
        },
        ...(canArchive
          ? [
              {
                value: 'archived',
                label: tCommon('statuses.archived'),
                actionLabel: tCommon('statuses.archived'),
                tone: 'warning',
              } satisfies StatusOption<ProgramEventStatusValue>,
            ]
          : []),
      ];
    }
    return [
      {
        value: 'draft',
        label: tCommon('statuses.draft'),
        actionLabel: tCommon('statuses.draft'),
        tone: 'neutral',
      },
      ...(canPublish
        ? [
            {
              value: 'published',
              label: tCommon('statuses.published'),
              actionLabel: tCommon('actions.publish'),
              tone: 'positive',
            } satisfies StatusOption<ProgramEventStatusValue>,
          ]
        : []),
    ];
  }, [canArchive, canPublish, status, tCommon]);

  const changeStatus = useCallback(
    (nextStatus: ProgramEventStatusValue) => {
      if (nextStatus === 'published' && canPublish) {
        publish.mutate();
      } else if (nextStatus === 'archived' && canArchive) {
        archive.mutate();
      }
    },
    [archive, canArchive, canPublish, publish],
  );

  const requestDelete = useCallback(() => {
    if (canDelete) {
      deleteEvent.mutate();
    }
  }, [canDelete, deleteEvent.mutate]);

  return {
    status,
    canEdit,
    canDelete,
    statusOptions,
    isEditable,
    mutateEditableEvent,
    changeStatus,
    deleteEvent: { ...deleteEvent, mutate: requestDelete },
    isStatusChanging: publish.isPending || archive.isPending,
  };
}
