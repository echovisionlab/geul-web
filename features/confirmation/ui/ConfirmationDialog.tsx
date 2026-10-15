'use client';

import { ConfirmModal, type ConfirmModalProps } from '@/components/core/Modal';
import { confirmationTreatments, type ConfirmationIntent } from './confirmation-intent';

export interface ConfirmationDialogProps extends Omit<ConfirmModalProps, 'confirmTone' | 'confirmEmphasis'> {
  intent: ConfirmationIntent;
  confirmTone?: never;
  confirmEmphasis?: never;
}

/** Shared product confirmation. Callers retain their command, impact details and pending state. */
export function ConfirmationDialog({
  intent,
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  closeLabel,
  loading,
  confirmDisabled,
  centered,
  size,
}: ConfirmationDialogProps) {
  const treatment = confirmationTreatments[intent];
  return (
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      closeLabel={closeLabel}
      loading={loading}
      confirmDisabled={confirmDisabled}
      centered={centered}
      size={size}
      confirmTone={treatment.tone}
      confirmEmphasis={treatment.emphasis}
    />
  );
}
