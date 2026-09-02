'use client';

import type { ReactNode } from 'react';
import { IconCalendar, IconHistory, IconMarkdown, IconMaximize, IconMinimize, IconUsers } from '@tabler/icons-react';
import { Stack, Text } from '@mantine/core';
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
  onBack: () => void;
  onStatusChange?: (status: PostStatus) => void;
  onDelete?: () => void;
  onOpenVersionHistory?: () => void;
  onOpenParticipants?: () => void;
  onReschedule?: () => void;
  onExportMarkdown: () => void;
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
      icon: <IconHistory size={16} />,
    });
  }
  if (showEditorChrome && onOpenParticipants) {
    collabActions.push({
      label: t('participantsAction'),
      onClick: onOpenParticipants,
      icon: <IconUsers size={16} />,
    });
  }

  const zenModeLabel = isZenMode ? t('actions.exitZen') : t('actions.zenMode');
  const headerActions: EditorHeaderActionItem[] = [
    {
      key: 'zen-mode',
      label: zenModeLabel,
      tooltip: zenModeLabel,
      ariaLabel: zenModeLabel,
      icon: isZenMode ? <IconMinimize size={20} /> : <IconMaximize size={20} />,
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
      icon: <IconCalendar size={20} />,
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
      icon: <IconMarkdown size={20} />,
      iconOnly: true,
      onClick: onExportMarkdown,
    });
  }

  return (
    <Stack gap="xs">
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
                  <Text>
                    {tCommon.rich('messages.confirmDeleteNamedRich', {
                      name: title || tCommon('states.untitled'),
                      strong: (chunks) => <strong>{chunks}</strong>,
                    })}
                  </Text>
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
        <Text size="xs" c="dimmed">
          {t('schedule.scheduledFor', {
            value: scheduledDateTime.dateTime(scheduledAt, {
              dateStyle: 'medium',
              timeStyle: 'long',
            }),
            timeZone: scheduledTimeZone,
          })}
        </Text>
      ) : null}
    </Stack>
  );
}
