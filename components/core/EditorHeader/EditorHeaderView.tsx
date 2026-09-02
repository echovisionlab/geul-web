'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { IconArrowLeft, IconChevronDown, IconTrash } from '@tabler/icons-react';
import { Box, Flex, Group, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { LabelBadge } from '../Badge';
import { Button, type ControlEmphasis, type ControlTone } from '../Button';
import { DropdownMenu } from '../DropdownMenu';
import { IconButton } from '../IconButton';
import { TextInput } from '../Input';
import { ConfirmModal } from '../Modal';
import { Tooltip } from '../Tooltip';
import { CollabSyncStatusIndicator } from './CollabSyncStatusIndicator';

export interface StatusOption<TStatus extends string> {
  value: TStatus;
  label: string;
  actionLabel: string;
  tone: ControlTone;
}

export interface EditorHeaderCollabAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  tone?: ControlTone;
  disabled?: boolean;
}

export interface EditorHeaderActionItem {
  key: string;
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  iconOnly?: boolean;
  tooltip?: string;
  ariaLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  tone?: ControlTone;
  emphasis?: ControlEmphasis;
}

export interface EditorHeaderProps<TStatus extends string = string> {
  title: string;
  onTitleChange?: (value: string) => void;
  titleInputId?: string;
  titlePlaceholder?: string;
  titleDisabled?: boolean;
  isConnected: boolean;
  isSynced: boolean;
  hideConnectionStatus?: boolean;
  onBack: () => void;
  backTooltip?: string;
  controls?: ReactNode;
  actionItems?: EditorHeaderActionItem[];
  actions?: ReactNode;
  hideBack?: boolean;

  // Status - all optional
  status?: TStatus;
  statusOptions?: StatusOption<TStatus>[];
  onStatusChange?: (status: TStatus) => void;
  isStatusChanging?: boolean;
  hideStatus?: boolean;
  groupStatusWithCollab?: boolean;
  collabActions?: EditorHeaderCollabAction[];

  // Delete - optional
  onDelete?: () => void;
  isDeleting?: boolean;
  deleteConfirmation?: {
    title: string;
    message: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmTone?: ControlTone;
  };
}

export interface EditorHeaderViewLabels {
  back: string;
  untitled: string;
  delete: string;
  cancel: string;
  close: string;
  changeStatus: string;
  collabButton: string;
  connection: string;
  current: string;
  status: string;
  actions: string;
  syncStatus: string;
}

export interface EditorHeaderViewProps<TStatus extends string = string> extends EditorHeaderProps<TStatus> {
  labels: EditorHeaderViewLabels;
}

export function EditorHeaderView<TStatus extends string = string>({
  title,
  onTitleChange,
  titleInputId,
  titlePlaceholder,
  titleDisabled,
  status,
  statusOptions,
  isConnected,
  isSynced,
  hideConnectionStatus,
  onBack,
  onStatusChange,
  onDelete,
  isStatusChanging,
  isDeleting,
  deleteConfirmation,
  backTooltip,
  controls,
  actionItems,
  actions,
  hideBack,
  hideStatus,
  groupStatusWithCollab,
  collabActions,
  labels,
}: EditorHeaderViewProps<TStatus>) {
  const isMobile = Boolean(useMediaQuery('(max-width: 48em)'));
  const [deleteConfirmOpened, setDeleteConfirmOpened] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);

  useEffect(() => {
    setDraftTitle(title);
  }, [title]);
  const hasStatus = status !== undefined && statusOptions !== undefined && statusOptions.length > 0;
  const currentOption = hasStatus ? statusOptions.find((opt) => opt.value === status) : undefined;
  const otherOptions = hasStatus ? statusOptions.filter((opt) => opt.value !== status) : [];
  const showCollabMenu = groupStatusWithCollab;
  const visibleCollabActions = collabActions ?? [];
  const hasStandaloneStatusAction =
    !showCollabMenu && hasStatus && !hideStatus && Boolean(onStatusChange) && otherOptions.length > 0;
  const hasActionBar =
    showCollabMenu ||
    Boolean(controls) ||
    Boolean(actionItems?.length) ||
    Boolean(actions) ||
    Boolean(onDelete) ||
    hasStandaloneStatusAction;
  const inlineMeta = !showCollabMenu ? (
    <>
      {hasStatus && !hideStatus && (
        <LabelBadge tone={currentOption?.tone ?? 'neutral'}>{currentOption?.label ?? status}</LabelBadge>
      )}
      {!hideConnectionStatus && (
        <CollabSyncStatusIndicator isConnected={isConnected} isSynced={isSynced} label={labels.syncStatus} />
      )}
    </>
  ) : null;

  const handleDeleteClick = () => {
    if (!onDelete) {
      return;
    }

    if (deleteConfirmation) {
      setDeleteConfirmOpened(true);
      return;
    }

    onDelete();
  };

  const handleDeleteConfirm = () => {
    if (!onDelete) {
      return;
    }

    onDelete();
  };

  const titleRow = (
    <Group flex={1} gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
      {!hideBack && (
        <Tooltip label={backTooltip || labels.back}>
          <IconButton emphasis="low" onClick={onBack} aria-label={backTooltip || labels.back} style={{ flexShrink: 0 }}>
            <IconArrowLeft size={20} />
          </IconButton>
        </Tooltip>
      )}
      {onTitleChange ? (
        <TextInput
          id={titleInputId}
          placeholder={titlePlaceholder ?? labels.untitled}
          value={draftTitle}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setDraftTitle(value);
            if (value.trim()) {
              onTitleChange(value);
            }
          }}
          variant="unstyled"
          styles={{
            root: { flex: 1, minWidth: 0 },
            input: {
              margin: 0,
              padding: '0.25rem 0.5rem',
              fontSize: isMobile ? '1.25rem' : '1.5rem',
              fontWeight: 700,
              lineHeight: 1.2,
            },
          }}
          disabled={titleDisabled}
        />
      ) : (
        <Text
          component="h1"
          fw={700}
          fz={isMobile ? '1.25rem' : '1.5rem'}
          lh={1.2}
          m={0}
          truncate
          style={{ minWidth: 0 }}
        >
          {title || titlePlaceholder || labels.untitled}
        </Text>
      )}
      {inlineMeta ? (
        <Group gap="xs" wrap="nowrap" ml="auto" style={{ flexShrink: 0 }}>
          {inlineMeta}
        </Group>
      ) : null}
    </Group>
  );

  const actionBar = (
    <>
      {showCollabMenu ? (
        <DropdownMenu size="wide" placement="bottom-end">
          <DropdownMenu.Target>
            <Button
              data-testid="editor-header-collab-button"
              emphasis="medium"
              size="xs"
              loading={Boolean(hasStatus && !hideStatus && isStatusChanging)}
              leftSection={
                <CollabSyncStatusIndicator
                  isConnected={isConnected}
                  isSynced={isSynced}
                  label={labels.syncStatus}
                  withTooltip={false}
                />
              }
              rightSection={<IconChevronDown size={14} />}
              style={{ flexShrink: 0 }}
            >
              {labels.collabButton}
            </Button>
          </DropdownMenu.Target>
          <DropdownMenu.Dropdown data-testid="editor-header-collab-dropdown">
            <DropdownMenu.Label>{labels.connection}</DropdownMenu.Label>
            <Box px="sm" py={6} data-testid="editor-header-collab-connection">
              <Group gap="xs" wrap="nowrap">
                <CollabSyncStatusIndicator
                  isConnected={isConnected}
                  isSynced={isSynced}
                  label={labels.syncStatus}
                  withTooltip={false}
                />
                <Text size="sm">{labels.syncStatus}</Text>
              </Group>
            </Box>

            {hasStatus && !hideStatus && (
              <>
                <DropdownMenu.Divider />
                <DropdownMenu.Label>{labels.status}</DropdownMenu.Label>
                <Box px="sm" py={6} data-testid="editor-header-collab-current-status">
                  <Group justify="space-between" wrap="nowrap">
                    <Text size="sm" c="dimmed">
                      {labels.current}
                    </Text>
                    <LabelBadge tone={currentOption?.tone ?? 'neutral'}>{currentOption?.label ?? status}</LabelBadge>
                  </Group>
                </Box>
                {onStatusChange &&
                  otherOptions.map((opt) => (
                    <DropdownMenu.Item
                      key={opt.value}
                      data-testid={`editor-header-collab-status-action-${opt.value}`}
                      tone={opt.tone}
                      disabled={isStatusChanging}
                      onClick={() => onStatusChange(opt.value)}
                    >
                      {opt.actionLabel}
                    </DropdownMenu.Item>
                  ))}
              </>
            )}

            {visibleCollabActions.length > 0 && (
              <>
                <DropdownMenu.Divider />
                <DropdownMenu.Label>{labels.actions}</DropdownMenu.Label>
                <div data-testid="editor-header-collab-actions-section">
                  {visibleCollabActions.map((action) => (
                    <DropdownMenu.Item
                      key={action.label}
                      icon={action.icon}
                      tone={action.tone}
                      onClick={action.onClick}
                      disabled={action.disabled}
                    >
                      {action.label}
                    </DropdownMenu.Item>
                  ))}
                </div>
              </>
            )}
          </DropdownMenu.Dropdown>
        </DropdownMenu>
      ) : null}
      {controls ? (
        <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
          {controls}
        </Group>
      ) : null}
      {actionItems && actionItems.length > 0 ? (
        <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
          {actionItems.map((item) =>
            item.iconOnly ? (
              <Tooltip key={item.key} label={item.tooltip ?? item.label}>
                <IconButton
                  tone={item.tone}
                  emphasis={item.emphasis ?? 'low'}
                  onClick={item.onClick}
                  disabled={item.disabled}
                  loading={item.loading}
                  aria-label={item.ariaLabel ?? item.label}
                  style={{ flexShrink: 0 }}
                >
                  {item.icon}
                </IconButton>
              </Tooltip>
            ) : (
              <Button
                key={item.key}
                size="xs"
                tone={item.tone}
                emphasis={item.emphasis}
                leftSection={item.icon}
                onClick={item.onClick}
                disabled={item.disabled}
                loading={item.loading}
                style={{ minWidth: 0, flexShrink: 0 }}
              >
                {item.label}
              </Button>
            ),
          )}
        </Group>
      ) : null}
      {actions ? (
        <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
          {actions}
        </Group>
      ) : null}
      {onDelete && (
        <Tooltip label={labels.delete}>
          <IconButton
            tone="danger"
            emphasis="low"
            onClick={handleDeleteClick}
            loading={isDeleting}
            aria-label={labels.delete}
            data-editor-delete
            style={{ flexShrink: 0 }}
          >
            <IconTrash size={20} />
          </IconButton>
        </Tooltip>
      )}
      {!showCollabMenu && hasStatus && !hideStatus && onStatusChange && otherOptions.length === 1 ? (
        <Button
          emphasis="medium"
          tone={otherOptions[0].tone}
          size="xs"
          onClick={() => onStatusChange(otherOptions[0].value)}
          loading={isStatusChanging}
          style={{ flexShrink: 0 }}
        >
          {otherOptions[0].actionLabel}
        </Button>
      ) : !showCollabMenu && hasStatus && !hideStatus && onStatusChange && otherOptions.length > 1 ? (
        <DropdownMenu size="compact">
          <DropdownMenu.Target>
            <Button
              data-testid="editor-header-change-status"
              emphasis="medium"
              size="xs"
              loading={isStatusChanging}
              style={{ flexShrink: 0 }}
            >
              {labels.changeStatus}
            </Button>
          </DropdownMenu.Target>
          <DropdownMenu.Dropdown>
            {otherOptions.map((opt) => (
              <DropdownMenu.Item key={opt.value} tone={opt.tone} onClick={() => onStatusChange(opt.value)}>
                {opt.actionLabel}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Dropdown>
        </DropdownMenu>
      ) : null}
    </>
  );

  return (
    <>
      {isMobile ? (
        <Stack gap="xs" data-testid="editor-header-mobile">
          {titleRow}
          {hasActionBar ? (
            <Box
              data-testid="editor-header-mobile-action-bar"
              style={{
                maxWidth: '100%',
                overflowX: 'auto',
                overflowY: 'hidden',
                WebkitOverflowScrolling: 'touch',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <Group gap="xs" wrap="nowrap" align="center" justify="flex-end" style={{ minWidth: 'max-content' }}>
                {actionBar}
              </Group>
            </Box>
          ) : null}
        </Stack>
      ) : (
        <Flex align="flex-start" justify="space-between" gap="sm" data-testid="editor-header">
          {titleRow}
          {hasActionBar ? (
            <Group gap="xs" wrap="nowrap" align="center" justify="flex-end" style={{ minWidth: 0, flexShrink: 0 }}>
              {actionBar}
            </Group>
          ) : null}
        </Flex>
      )}
      {onDelete && deleteConfirmation ? (
        <ConfirmModal
          opened={deleteConfirmOpened}
          onClose={() => setDeleteConfirmOpened(false)}
          onConfirm={handleDeleteConfirm}
          title={deleteConfirmation.title}
          message={deleteConfirmation.message}
          confirmLabel={deleteConfirmation.confirmLabel ?? labels.delete}
          cancelLabel={deleteConfirmation.cancelLabel ?? labels.cancel}
          closeLabel={labels.close}
          confirmTone={deleteConfirmation.confirmTone}
          loading={Boolean(isDeleting)}
        />
      ) : null}
    </>
  );
}
