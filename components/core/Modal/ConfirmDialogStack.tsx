'use client';
import { useSyncExternalStore } from 'react';
import { ConfirmModal } from './ConfirmModal';
import {
  confirmDialog,
  confirmDialogs,
  getConfirmDialogs,
  getServerConfirmDialogs,
  subscribeConfirmDialogs,
} from './confirm-dialog-store';
/** Renders the newest queued confirmation. Loaded on demand by `ConfirmDialogHost`. */
export function ConfirmDialogStack() {
  const dialogs = useSyncExternalStore(subscribeConfirmDialogs, getConfirmDialogs, getServerConfirmDialogs);
  const current = dialogs.at(-1);
  if (!current) {
    return null;
  }
  const { options, id } = current;
  return (
    <ConfirmModal
      opened
      title={options.title}
      message={options.message}
      cancelLabel={options.cancelLabel}
      confirmLabel={options.confirmLabel}
      closeLabel={options.closeLabel}
      confirmTone={options.tone ?? 'neutral'}
      confirmEmphasis={options.emphasis ?? 'strong'}
      loading={current.pending}
      onClose={() => confirmDialogs.close(id)}
      onConfirm={() => confirmDialog(id)}
    />
  );
}
