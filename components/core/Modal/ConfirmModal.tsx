'use client';

import type { OverlayPresentationProps } from '../overlay-contract';

import { useId, type ReactNode } from 'react';
import { LayoutStack } from '../Layout';
import { Text } from '../Typography';
import { DialogActions } from './DialogActions';
import { OverlayDialog } from './OverlayDialog';
import { Button, type ControlEmphasis, type ControlTone } from '../Button';

export type ConfirmModalSize = 'compact' | 'standard' | 'large';

export interface ConfirmModalProps extends OverlayPresentationProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  confirmTone?: ControlTone;
  confirmEmphasis?: ControlEmphasis;
  loading?: boolean;
  confirmDisabled?: boolean;
  centered?: boolean;
  size?: ConfirmModalSize;
}

export function ConfirmModal({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  closeLabel,
  confirmTone = 'neutral',
  confirmEmphasis = 'strong',
  loading = false,
  confirmDisabled = false,
  centered = false,
  size = 'standard',
}: ConfirmModalProps) {
  const messageId = useId();
  const describeMessage = typeof message === 'string' && Boolean(message.trim());
  const focusCancel = confirmTone === 'danger' || confirmDisabled;
  return (
    <OverlayDialog
      opened={opened}
      onClose={onClose}
      title={title}
      descriptionId={describeMessage ? messageId : undefined}
      dismissible={!loading}
      busy={loading}
      closeLabel={closeLabel}
      centered={centered}
      size={size}
    >
      <LayoutStack>
        {typeof message === 'string' ? (
          <Text as="p" id={describeMessage ? messageId : undefined}>
            {message}
          </Text>
        ) : (
          message
        )}
        <DialogActions>
          <Button
            type="button"
            tone="neutral"
            emphasis="low"
            onClick={onClose}
            disabled={loading}
            autoFocus={focusCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            tone={confirmTone}
            emphasis={confirmEmphasis}
            onClick={onConfirm}
            loading={loading}
            disabled={confirmDisabled || loading}
            autoFocus={!focusCancel}
          >
            {confirmLabel}
          </Button>
        </DialogActions>
      </LayoutStack>
    </OverlayDialog>
  );
}
