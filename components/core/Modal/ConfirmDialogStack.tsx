'use client';
import { useSyncExternalStore } from 'react';
import { ConfirmModal } from './ConfirmModal';
import {
  confirmDialogs,
  getConfirmDialogs,
  getServerConfirmDialogs,
  publishConfirmDialogs,
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
      onConfirm={() => {
        // Guard against repeated events before React commits the pending render.
        const entries = getConfirmDialogs();
        const active = entries.at(-1);
        if (active?.id !== id || active.pending) {
          return;
        }
        publishConfirmDialogs(entries.map((entry) => (entry.id === id ? { ...entry, pending: true } : entry)));
        Promise.resolve()
          .then(options.onConfirm)
          .then(
            () => {
              publishConfirmDialogs(getConfirmDialogs().filter((entry) => entry.id !== id));
            },
            (error) => {
              publishConfirmDialogs(
                getConfirmDialogs().map((entry) => (entry.id === id ? { ...entry, pending: false } : entry)),
              );
              options.onError?.(error);
            },
          );
      }}
    />
  );
}
