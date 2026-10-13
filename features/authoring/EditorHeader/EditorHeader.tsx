'use client';

import { useTranslations } from 'next-intl';
import { EditorHeaderView, type EditorHeaderProps, type EditorHeaderViewLabels } from '@/components/core/EditorHeader';
import { ConfirmationDialog } from '@/features/confirmation';

export function EditorHeader<TStatus extends string = string>(props: EditorHeaderProps<TStatus>) {
  const t = useTranslations('editorHeader');
  const tCommonActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const tStates = useTranslations('common.states');
  const hasStatus = props.status !== undefined && Boolean(props.statusOptions?.length);
  const currentOption = hasStatus ? props.statusOptions?.find((option) => option.value === props.status) : undefined;
  const syncStatus = props.isConnected ? (props.isSynced ? tStates('synced') : tStates('syncing')) : tStates('offline');

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
    <EditorHeaderView
      {...props}
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
  );
}

export type {
  EditorHeaderActionItem,
  EditorHeaderCollabAction,
  EditorHeaderProps,
  StatusOption,
} from '@/components/core/EditorHeader';
