'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import type { ReactNode } from 'react';
import { IconCalendar, IconHistory, IconMarkdown, IconMaximize, IconMinimize, IconUsers } from '@tabler/icons-react';

import { useTranslations } from 'next-intl';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import {
  EditorHeader,
  type EditorHeaderActionItem,
  type EditorHeaderCollabAction,
  type StatusOption,
} from '@/features/editor/EditorHeader';
import type { PostStatus } from '@/lib/types/post/model';

interface PostEditorHeaderSectionProps {
  postId: string;
  title: string;
  canEditTitle: boolean;
  onTitleChange: (value: string) => void;
  status: PostStatus;
  statusOptions: StatusOption<PostStatus>[];
  isConnected: boolean;
  isSynced: boolean;
  isStatusChanging: boolean;
  isDeleting: boolean;
  isZenMode: boolean;
  controls: ReactNode;
  scheduledAt: string | null;
  scheduledTimeZone: string | null;
  onBack: () => void | Promise<unknown>;
  onStatusChange?: (status: PostStatus) => void;
  onDelete?: () => void;
  onOpenVersionHistory?: () => void;
  onOpenParticipants?: () => void;
  onReschedule?: () => void;
  onExportMarkdown: () => void;
  exportingMarkdown?: boolean;
  onToggleZenMode: () => void;
}

export function PostEditorHeaderSection({
  postId,
  title,
  canEditTitle,
  onTitleChange,
  status,
  statusOptions,
  isConnected,
  isSynced,
  isStatusChanging,
  isDeleting,
  isZenMode,
  controls,
  scheduledAt,
  scheduledTimeZone,
  onBack,
  onStatusChange,
  onDelete,
  onOpenVersionHistory,
  onOpenParticipants,
  onReschedule,
  onExportMarkdown,
  exportingMarkdown = false,
  onToggleZenMode,
}: PostEditorHeaderSectionProps) {
  const tCommon = useTranslations('common');
  const tCommonLabels = useTranslations('common.labels');
  const t = useTranslations('postEditor');
  const scheduledDateTime = useDateTimeFormatter(scheduledTimeZone ?? undefined);
  const showEditorChrome = !isZenMode;
  const showScheduleSummary = showEditorChrome && status === 'scheduled' && scheduledAt && scheduledTimeZone;

  const collabActions: EditorHeaderCollabAction[] = [];
  if (showEditorChrome && onOpenVersionHistory) {
    collabActions.push({
      label: tCommonLabels('versionHistory'),
      onClick: onOpenVersionHistory,
      icon: <IconHistory />,
    });
  }
  if (showEditorChrome && onOpenParticipants) {
    collabActions.push({
      label: t('participantsAction'),
      onClick: onOpenParticipants,
      icon: <IconUsers />,
    });
  }

  const zenModeLabel = isZenMode ? t('actions.exitZen') : t('actions.zenMode');
  const headerActions: EditorHeaderActionItem[] = [
    {
      key: 'zen-mode',
      label: zenModeLabel,
      tooltip: zenModeLabel,
      ariaLabel: zenModeLabel,
      icon: isZenMode ? <IconMinimize /> : <IconMaximize />,
      iconOnly: true,
      onClick: onToggleZenMode,
    },
  ];

  if (showEditorChrome && onReschedule) {
    const rescheduleLabel = t('statusActions.reschedule');
    headerActions.push({
      key: 'reschedule',
      label: rescheduleLabel,
      tooltip: rescheduleLabel,
      ariaLabel: rescheduleLabel,
      icon: <IconCalendar />,
      iconOnly: true,
      onClick: onReschedule,
    });
  }
  if (showEditorChrome) {
    const markdownLabel = tCommon('actions.markdown');
    headerActions.push({
      key: 'export-markdown',
      label: markdownLabel,
      tooltip: markdownLabel,
      ariaLabel: markdownLabel,
      icon: <IconMarkdown />,
      iconOnly: true,
      onClick: onExportMarkdown,
      loading: exportingMarkdown,
    });
  }

  return (
    <DsLayoutStack gap="xs">
      <EditorHeader
        title={title}
        onTitleChange={canEditTitle ? onTitleChange : undefined}
        titleInputId={`post-${postId}-title`}
        titlePlaceholder={tCommon('states.untitledEntity', { entity: tCommon('entities.post') })}
        titleDisabled={!canEditTitle}
        status={status}
        statusOptions={statusOptions}
        isConnected={isConnected}
        isSynced={isSynced}
        onBack={onBack}
        onStatusChange={onStatusChange}
        onDelete={onDelete}
        deleteConfirmation={
          onDelete
            ? {
                title: tCommon('actions.delete'),
                message: (
                  <DsText>
                    {tCommon.rich('messages.confirmDeleteNamedRich', {
                      name: title || tCommon('states.untitled'),
                      strong: (chunks) => <strong>{chunks}</strong>,
                    })}
                  </DsText>
                ),
              }
            : undefined
        }
        isStatusChanging={isStatusChanging}
        isDeleting={isDeleting}
        backTooltip={tCommon('actions.back')}
        hideBack={isZenMode}
        hideStatus={isZenMode}
        groupStatusWithCollab
        collabActions={collabActions}
        controls={controls}
        actionItems={headerActions}
      />

      {showScheduleSummary ? (
        <DsText size="xs" tone="secondary">
          {t('schedule.scheduledFor', {
            value: scheduledDateTime.dateTime(scheduledAt, {
              dateStyle: 'medium',
              timeStyle: 'long',
            }),
            timeZone: scheduledTimeZone,
          })}
        </DsText>
      ) : null}
    </DsLayoutStack>
  );
}
