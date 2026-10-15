'use client';

import { useOptionalEditorRuntimeContext } from '@/lib/contexts/editor-runtime-context-value';
import { useEditorSaveState } from '@/lib/editor/useEditorSaveState';
import { useTranslations } from 'next-intl';
import { EditorHeaderView, type EditorHeaderProps, type EditorHeaderViewLabels } from '@/components/core/EditorHeader';
import { ConfirmationDialog } from '@/features/confirmation';
import { useRejectedEditorSaves } from '@/lib/editor/useRejectedEditorSaves';
import { IconCloudX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { setRoomJournalTitle } from '@/lib/collab/room-journal-titles';
import { RejectedEditsDialog } from './RejectedEditsDialog';

export function EditorHeader<TStatus extends string = string>(props: EditorHeaderProps<TStatus>) {
  const t = useTranslations('editorHeader');
  const tCommonActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const tStates = useTranslations('common.states');
  const hasStatus = props.status !== undefined && Boolean(props.statusOptions?.length);
  const currentOption = hasStatus ? props.statusOptions?.find((option) => option.value === props.status) : undefined;
  const runtime = useOptionalEditorRuntimeContext();
  const saveDocument = runtime ? `${runtime.entityType}:${runtime.entityId}` : undefined;
  const derivedSaveState = useEditorSaveState(saveDocument, props.isConnected, props.isSynced);
  const rejected = useRejectedEditorSaves(saveDocument);
  // Local backups name the document by the title shown here (Notion's backups carry the title).
  const roomName = runtime?.provider?.configuration.name;
  const runtimeType = runtime?.entityType;
  const runtimeId = runtime?.entityId;
  useEffect(() => {
    const [type, id] = roomName?.split(':') ?? [runtimeType, runtimeId];
    if (type && id) {
      setRoomJournalTitle(type, id, props.title);
    }
  }, [props.title, roomName, runtimeId, runtimeType]);
  const [reviewingRejected, setReviewingRejected] = useState(false);
  const collabActions = rejected.length
    ? [
        {
          label: t('rejectedEdits.open'),
          icon: <IconCloudX size="1em" aria-hidden />,
          tone: 'danger' as const,
          onClick: () => setReviewingRejected(true),
        },
        ...(props.collabActions ?? []),
      ]
    : props.collabActions;
  const saveState = props.saveState ?? derivedSaveState;
  const syncStatus = t(`saveState.${saveState}`);

  const labels: EditorHeaderViewLabels = {
    back: tCommonActions('back'),
    untitled: tStates('untitledPlain'),
    title: tCommonLabels('title'),
    delete: tCommonActions('delete'),
    cancel: tCommonActions('cancel'),
    close: tCommonActions('close'),
    changeStatus: t('actions.changeStatus'),
    collabButton:
      hasStatus && !props.hideStatus && currentOption
        ? t('collab.buttonWithStatus', { status: currentOption.label })
        : t('collab.button'),
    connection: t('collab.sections.connection'),
    current: t('collab.current'),
    status: tCommonLabels('status'),
    actions: tCommonLabels('actions'),
    syncStatus,
  };

  return (
    <>
      <EditorHeaderView
        {...props}
        collabActions={collabActions}
        saveState={saveState}
        labels={labels}
        renderDeleteConfirmation={(state) =>
          props.deleteConfirmation ? (
            <ConfirmationDialog
              {...state}
              intent="delete"
              title={props.deleteConfirmation.title}
              message={props.deleteConfirmation.message}
              confirmLabel={props.deleteConfirmation.confirmLabel ?? labels.delete}
              cancelLabel={props.deleteConfirmation.cancelLabel ?? labels.cancel}
              closeLabel={labels.close}
            />
          ) : null
        }
      />
      <RejectedEditsDialog opened={reviewingRejected} onClose={() => setReviewingRejected(false)} rejected={rejected} />
    </>
  );
}

export type {
  EditorHeaderActionItem,
  EditorHeaderCollabAction,
  EditorHeaderProps,
  StatusOption,
} from '@/components/core/EditorHeader';
