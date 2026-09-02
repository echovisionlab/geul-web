'use client';

import type { ReactNode, SubmitEvent } from 'react';
import { Box, Group, Modal, Stack, type ModalProps as MantineModalProps } from '@mantine/core';
import { Button, type ControlTone } from '../Button';

export type FormModalSize = 'compact' | 'standard' | 'large';

export interface FormModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: () => void;
  title: string;
  children: ReactNode;
  submitLabel: string;
  cancelLabel: string;
  closeLabel: string;
  submitTone?: ControlTone;
  loading?: boolean;
  submitDisabled?: boolean;
  size?: FormModalSize;
}

const MODAL_SIZES: Record<FormModalSize, NonNullable<MantineModalProps['size']>> = {
  compact: 'sm',
  standard: 'md',
  large: 'lg',
};

export function FormModal({
  opened,
  onClose,
  onSubmit,
  title,
  children,
  submitLabel,
  cancelLabel,
  closeLabel,
  submitTone = 'accent',
  loading = false,
  submitDisabled = false,
  size = 'standard',
}: FormModalProps) {
  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loading && !submitDisabled) {
      onSubmit();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
      withCloseButton={!loading}
      closeButtonProps={{ 'aria-label': closeLabel }}
      size={MODAL_SIZES[size]}
      data-size={size}
    >
      <Box component="form" onSubmit={handleSubmit}>
        <Stack>
          {children}
          <Group justify="flex-end">
            <Button type="button" tone="neutral" emphasis="low" onClick={onClose} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button type="submit" loading={loading} disabled={submitDisabled || loading} tone={submitTone}>
              {submitLabel}
            </Button>
          </Group>
        </Stack>
      </Box>
    </Modal>
  );
}
