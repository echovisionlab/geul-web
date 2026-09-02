'use client';

import type { ReactNode } from 'react';
import { Group, Modal, Stack, Text, type ModalProps as MantineModalProps } from '@mantine/core';
import { Button, type ControlTone } from '../Button';

export type ConfirmModalSize = 'compact' | 'standard' | 'large';

export interface ConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  confirmTone?: ControlTone;
  loading?: boolean;
  confirmDisabled?: boolean;
  centered?: boolean;
  size?: ConfirmModalSize;
}

const MODAL_SIZES: Record<ConfirmModalSize, NonNullable<MantineModalProps['size']>> = {
  compact: 'sm',
  standard: 'md',
  large: 'lg',
};

export function ConfirmModal({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  closeLabel,
  confirmTone = 'danger',
  loading = false,
  confirmDisabled = false,
  centered = false,
  size = 'standard',
}: ConfirmModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
      withCloseButton={!loading}
      closeButtonProps={{ 'aria-label': closeLabel }}
      centered={centered}
      size={MODAL_SIZES[size]}
      data-centered={centered || undefined}
      data-size={size}
    >
      <Stack>
        {typeof message === 'string' ? <Text>{message}</Text> : message}
        <Group justify="flex-end">
          <Button type="button" tone="neutral" emphasis="low" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            tone={confirmTone}
            onClick={onConfirm}
            loading={loading}
            disabled={confirmDisabled || loading}
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
