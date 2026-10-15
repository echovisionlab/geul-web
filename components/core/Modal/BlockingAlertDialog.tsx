'use client';

import type { OverlayPresentationProps } from '../overlay-contract';

import { useId, type ReactNode } from 'react';
import { Button } from '../Button';
import { LayoutStack } from '../Layout';
import { DialogActions } from './DialogActions';
import { OverlayDialog } from './OverlayDialog';

export type BlockingAlertDialogSize = 'compact' | 'standard';
export type BlockingAlertDialogLevel = 'info' | 'warning' | 'danger';

export interface BlockingAlertDialogProps extends OverlayPresentationProps {
  opened: boolean;
  onAction: () => void;
  title: string;
  message: ReactNode;
  actionLabel: string;
  level?: BlockingAlertDialogLevel;
  loading?: boolean;
  size?: BlockingAlertDialogSize;
  /** `obscure` hides the page behind the dialog completely (access to it ended). */
  backdrop?: 'dim' | 'obscure';
}

export function BlockingAlertDialog({
  opened,
  onAction,
  title,
  message,
  actionLabel,
  level = 'info',
  loading = false,
  size = 'standard',
  backdrop = 'dim',
}: BlockingAlertDialogProps) {
  const descriptionId = useId();
  if (
    opened &&
    (typeof title !== 'string' || !title.trim() || typeof actionLabel !== 'string' || !actionLabel.trim())
  ) {
    throw new TypeError('Core BlockingAlertDialog requires nonempty title and actionLabel');
  }
  return (
    <OverlayDialog
      opened={opened}
      onClose={() => {}}
      title={title}
      role="alertdialog"
      descriptionId={descriptionId}
      dismissible={false}
      busy={loading}
      size={size}
      centered
      level={level}
      backdrop={backdrop}
    >
      <LayoutStack gap="md">
        <div id={descriptionId}>{message}</div>
        <DialogActions>
          <Button
            emphasis="strong"
            type="button"
            tone={level === 'danger' ? 'danger' : level === 'warning' ? 'warning' : 'neutral'}
            onClick={onAction}
            loading={loading}
            disabled={loading}
            autoFocus
          >
            {actionLabel}
          </Button>
        </DialogActions>
      </LayoutStack>
    </OverlayDialog>
  );
}
