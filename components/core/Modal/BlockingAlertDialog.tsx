'use client';

import { useId, type ReactNode } from 'react';
import { IconAlertCircle, IconAlertTriangle, IconInfoCircle, type Icon } from '@tabler/icons-react';
import { FocusTrap, Group, Modal, Paper, Stack, Text } from '@mantine/core';
import { Button } from '../Button';

export type BlockingAlertDialogSize = 'compact' | 'standard';
export type BlockingAlertDialogLevel = 'info' | 'warning' | 'danger';

export interface BlockingAlertDialogProps {
  opened: boolean;
  onAction: () => void;
  title: string;
  message: ReactNode;
  actionLabel: string;
  level?: BlockingAlertDialogLevel;
  loading?: boolean;
  size?: BlockingAlertDialogSize;
}

const DIALOG_WIDTHS: Record<BlockingAlertDialogSize, string> = {
  compact: '24rem',
  standard: '30rem',
};

const LEVEL_PRESENTATION: Record<BlockingAlertDialogLevel, { icon: Icon; color: string }> = {
  info: { icon: IconInfoCircle, color: 'blue' },
  warning: { icon: IconAlertTriangle, color: 'yellow' },
  danger: { icon: IconAlertCircle, color: 'red' },
};

const ignoreDismissRequest = () => undefined;

export function BlockingAlertDialog({
  opened,
  onAction,
  title,
  message,
  actionLabel,
  level = 'info',
  loading = false,
  size = 'standard',
}: BlockingAlertDialogProps) {
  const reactId = useId();
  const titleId = `blocking-alert-title-${reactId}`;
  const messageId = `blocking-alert-message-${reactId}`;
  const presentation = LEVEL_PRESENTATION[level];
  const LevelIcon = presentation.icon;

  if (!opened) {
    return null;
  }

  return (
    <Modal.Root
      opened
      onClose={ignoreDismissRequest}
      closeOnClickOutside={false}
      closeOnEscape={false}
      returnFocus
      lockScroll
      trapFocus
      data-blocking-alert-dialog
      data-level={level}
      data-size={size}
    >
      <Modal.Overlay backgroundOpacity={0.55} blur={3} />
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 'calc(var(--mb-z-index) + 1)',
          display: 'grid',
          placeItems: 'center',
          padding: '1rem',
          pointerEvents: 'none',
        }}
      >
        <FocusTrap active>
          <Paper
            component="section"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={messageId}
            shadow="xl"
            p="lg"
            radius={0}
            tabIndex={-1}
            data-level={level}
            style={{
              width: `min(100%, ${DIALOG_WIDTHS[size]})`,
              pointerEvents: 'auto',
            }}
          >
            <Stack gap="md">
              <Group gap="sm" wrap="nowrap" align="flex-start">
                <LevelIcon size={22} color={`var(--mantine-color-${presentation.color}-6)`} aria-hidden />
                <Text component="h2" id={titleId} fw={600} size="lg">
                  {title}
                </Text>
              </Group>
              <div id={messageId}>{typeof message === 'string' ? <Text size="sm">{message}</Text> : message}</div>
              <Group justify="flex-end">
                <Button type="button" onClick={onAction} loading={loading} disabled={loading} autoFocus>
                  {actionLabel}
                </Button>
              </Group>
            </Stack>
          </Paper>
        </FocusTrap>
      </div>
    </Modal.Root>
  );
}
