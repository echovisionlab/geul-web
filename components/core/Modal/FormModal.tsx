'use client';

import type { OverlayPresentationProps } from '../overlay-contract';

import type { ReactNode, SubmitEvent } from 'react';
import { LayoutStack } from '../Layout';
import { DialogActions } from './DialogActions';
import { OverlayDialog } from './OverlayDialog';
import { Button, type ControlTone } from '../Button';

export type FormModalSize = 'compact' | 'standard' | 'large';

export interface FormModalProps extends OverlayPresentationProps {
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
    <OverlayDialog
      opened={opened}
      onClose={onClose}
      title={title}
      dismissible={!loading}
      busy={loading}
      closeLabel={closeLabel}
      size={size}
    >
      <form onSubmit={handleSubmit}>
        <LayoutStack>
          {children}
          <DialogActions>
            <Button type="button" tone="neutral" emphasis="low" onClick={onClose} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button
              emphasis="strong"
              type="submit"
              loading={loading}
              disabled={submitDisabled || loading}
              tone={submitTone}
            >
              {submitLabel}
            </Button>
          </DialogActions>
        </LayoutStack>
      </form>
    </OverlayDialog>
  );
}
