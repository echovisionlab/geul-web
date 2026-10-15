'use client';
import { resolveTransportSaveState, type EditorSaveState } from './save-state';
import { breakpointQuery } from '../Layout/breakpoints';
import { SupportingText, Heading } from '../Typography';
import { LayoutInset as DsLayoutInset, LayoutInline as DsLayoutInline, LayoutStack as DsLayoutStack } from '../Layout';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import { VisuallyHidden } from 'react-aria-components';
import { useMediaQuery } from '@mantine/hooks';
import { LabelBadge } from '../Badge';
import { Button, type ControlEmphasis, type ControlTone } from '../Button';
import { DropdownMenu } from '../DropdownMenu';
import { IconButton } from '../IconButton';
import { TextInput } from '../Input';
import { ConfirmModal } from '../Modal';
import { Tooltip } from '../Tooltip';
import { CollabSyncStatusIndicator } from './CollabSyncStatusIndicator';
import { ActionRowSizeProvider, HeaderDensityProvider } from '../control-context';
import { ToolbarSurface } from '../Section/ToolbarSurface';
import { ToolbarCommand } from '../Section/ToolbarCommand';
import classes from './EditorHeaderView.module.css';
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
  /** Overrides transport status for rooms with durable acknowledgements. */
  saveState?: EditorSaveState;
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
  renderDeleteConfirmation?: (state: {
    opened: boolean;
    onClose: () => void;
    onConfirm: () => void;
    loading: boolean;
  }) => ReactNode;
}
export interface EditorHeaderViewLabels {
  title: string;
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
  saveState,
  hideConnectionStatus,
  onBack,
  onStatusChange,
  onDelete,
  isStatusChanging,
  isDeleting,
  deleteConfirmation,
  renderDeleteConfirmation,
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
  const syncDescriptionId = useId();
  const isMobile = Boolean(useMediaQuery(breakpointQuery('sm')));
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
        <CollabSyncStatusIndicator
          state={saveState ?? resolveTransportSaveState(isConnected, isSynced)}
          label={labels.syncStatus}
        />
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
    <DsLayoutInline flexible gap="xs" wrap="nowrap">
      {!hideBack && (
        <Tooltip label={backTooltip || labels.back}>
          <IconButton emphasis="low" onClick={onBack} aria-label={backTooltip || labels.back}>
            <IconArrowLeft />
          </IconButton>
        </Tooltip>
      )}
      {onTitleChange ? (
        <TextInput
          grow
          appearance="bare"
          textRole="title"
          size={isMobile ? 'lg' : 'xl'}
          id={titleInputId}
          aria-label={labels.title}
          placeholder={titlePlaceholder ?? labels.untitled}
          value={draftTitle}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setDraftTitle(value);
            if (value.trim()) {
              onTitleChange(value);
            }
          }}
          disabled={titleDisabled}
        />
      ) : (
        <Heading level={1} scale={isMobile ? 3 : 2} flexible truncate>
          {title || titlePlaceholder || labels.untitled}
        </Heading>
      )}
      {inlineMeta ? (
        <DsLayoutInline flexible justify="end" gap="none">
          <DsLayoutInline gap="xs" wrap="nowrap" shrink={false}>
            {inlineMeta}
          </DsLayoutInline>
        </DsLayoutInline>
      ) : null}
    </DsLayoutInline>
  );
  const hasCommands = Boolean(actionItems?.length || actions || onDelete);
  const commands = (
    <ToolbarSurface label={labels.actions} appearance="inline" wrap="wrap" data-testid="editor-header-command-toolbar">
      {actionItems?.map((item) => (
        <ToolbarCommand
          key={item.key}
          {...(item.iconOnly && item.icon
            ? { presentation: 'icon' as const, icon: item.icon }
            : { presentation: 'label' as const, icon: item.icon })}
          label={item.label}
          tooltipLabel={item.tooltip}
          aria-label={item.ariaLabel ?? item.label}
          tone={item.tone}
          emphasis={item.emphasis}
          onClick={item.onClick}
          disabled={item.disabled}
          loading={item.loading}
        />
      ))}
      {actions}
      {onDelete ? (
        <ToolbarCommand
          presentation="icon"
          icon={<IconTrash size="1em" />}
          label={labels.delete}
          tone="danger"
          onClick={handleDeleteClick}
          loading={isDeleting}
          data-editor-delete
        />
      ) : null}
    </ToolbarSurface>
  );
  const actionBar = (
    <>
      {showCollabMenu ? (
        <DropdownMenu size="wide" placement="bottom-end">
          <DropdownMenu.Target>
            <Button
              data-testid="editor-header-collab-button"
              aria-label={
                isMobile && currentOption && !hideStatus
                  ? `${currentOption.label} ${labels.collabButton}`
                  : labels.collabButton
              }
              aria-describedby={syncDescriptionId}
              emphasis="medium"
              size="xs"
              loading={Boolean(hasStatus && !hideStatus && isStatusChanging)}
              leftSection={
                <CollabSyncStatusIndicator
                  state={saveState ?? resolveTransportSaveState(isConnected, isSynced)}
                  label={labels.syncStatus}
                  withTooltip={false}
                />
              }
              indicator="menu"
            >
              <span className={classes.contextLabel}>
                {isMobile && currentOption && !hideStatus ? currentOption.label : labels.collabButton}
              </span>
              <VisuallyHidden id={syncDescriptionId}>{labels.syncStatus}</VisuallyHidden>
            </Button>
          </DropdownMenu.Target>
          <DropdownMenu.Dropdown data-testid="editor-header-collab-dropdown">
            <DropdownMenu.Label>{labels.connection}</DropdownMenu.Label>
            <DsLayoutInset inline="sm" block="xxs" data-testid="editor-header-collab-connection">
              <DsLayoutInline gap="xs" wrap="nowrap">
                <CollabSyncStatusIndicator
                  state={saveState ?? resolveTransportSaveState(isConnected, isSynced)}
                  label={labels.syncStatus}
                  withTooltip={false}
                />
                <SupportingText tone="primary">{labels.syncStatus}</SupportingText>
              </DsLayoutInline>
            </DsLayoutInset>

            {hasStatus && !hideStatus && (
              <>
                <DropdownMenu.Divider />
                <DropdownMenu.Label>{labels.status}</DropdownMenu.Label>
                <DsLayoutInset inline="sm" block="xxs" data-testid="editor-header-collab-current-status">
                  <DsLayoutInline justify="between" wrap="nowrap">
                    <SupportingText tone="secondary">{labels.current}</SupportingText>
                    <LabelBadge tone={currentOption?.tone ?? 'neutral'}>{currentOption?.label ?? status}</LabelBadge>
                  </DsLayoutInline>
                </DsLayoutInset>
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
        <DsLayoutInline gap="xs" wrap="nowrap" shrink={false}>
          {controls}
        </DsLayoutInline>
      ) : null}
      {hasCommands ? commands : null}
      {!showCollabMenu && hasStatus && !hideStatus && onStatusChange && otherOptions.length === 1 ? (
        <Button
          emphasis="medium"
          tone={otherOptions[0].tone}
          size="xs"
          onClick={() => onStatusChange(otherOptions[0].value)}
          loading={isStatusChanging}
        >
          {otherOptions[0].actionLabel}
        </Button>
      ) : !showCollabMenu && hasStatus && !hideStatus && onStatusChange && otherOptions.length > 1 ? (
        <DropdownMenu size="compact">
          <DropdownMenu.Target>
            <Button data-testid="editor-header-change-status" emphasis="medium" size="xs" loading={isStatusChanging}>
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
      <HeaderDensityProvider density={isMobile ? 'compact' : 'comfortable'}>
        <ActionRowSizeProvider size="xs">
          {isMobile ? (
            <DsLayoutStack gap="xxs" data-testid="editor-header-mobile">
              {titleRow}
              {hasActionBar ? (
                <div data-testid="editor-header-mobile-action-bar">
                  <div className={classes.mobileActions}>{actionBar}</div>
                </div>
              ) : null}
            </DsLayoutStack>
          ) : (
            <DsLayoutInline align="center" justify="between" gap="sm" data-testid="editor-header">
              {titleRow}
              {hasActionBar ? (
                <DsLayoutInline gap="xs" wrap="nowrap" align="center" justify="end" shrink={false}>
                  {actionBar}
                </DsLayoutInline>
              ) : null}
            </DsLayoutInline>
          )}
        </ActionRowSizeProvider>
      </HeaderDensityProvider>
      {onDelete && deleteConfirmation ? (
        renderDeleteConfirmation ? (
          renderDeleteConfirmation({
            opened: deleteConfirmOpened,
            onClose: () => setDeleteConfirmOpened(false),
            onConfirm: handleDeleteConfirm,
            loading: Boolean(isDeleting),
          })
        ) : (
          <ConfirmModal
            opened={deleteConfirmOpened}
            onClose={() => setDeleteConfirmOpened(false)}
            onConfirm={handleDeleteConfirm}
            title={deleteConfirmation.title}
            message={deleteConfirmation.message}
            confirmLabel={deleteConfirmation.confirmLabel ?? labels.delete}
            cancelLabel={deleteConfirmation.cancelLabel ?? labels.cancel}
            closeLabel={labels.close}
            confirmTone={deleteConfirmation.confirmTone ?? 'danger'}
            confirmEmphasis="strong"
            loading={Boolean(isDeleting)}
          />
        )
      ) : null}
    </>
  );
}
