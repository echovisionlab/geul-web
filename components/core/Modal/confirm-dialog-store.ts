'use client';
import type { ReactNode } from 'react';
import type { ClosedVisualProps } from '../visual-contract';
import type { ControlEmphasis, ControlTone } from '../control-style';
export interface ConfirmDialogOptions extends ClosedVisualProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  tone?: ControlTone;
  emphasis?: ControlEmphasis;
  onConfirm: () => void | Promise<void>;
  onError?: (error: unknown) => void;
}
export interface ConfirmDialogEntry {
  id: string;
  options: ConfirmDialogOptions;
  pending: boolean;
}
// Module store: a request made before the dialog renderer has loaded waits here, so it is never lost.
let entries: readonly ConfirmDialogEntry[] = [];
const empty: readonly ConfirmDialogEntry[] = [];
const listeners = new Set<() => void>();
function publishConfirmDialogs(next: readonly ConfirmDialogEntry[]) {
  entries = next;
  listeners.forEach((fn) => fn());
}
export const getConfirmDialogs = () => entries;
export const getServerConfirmDialogs = () => empty;
export function subscribeConfirmDialogs(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export const confirmDialogs = {
  open(options: ConfirmDialogOptions) {
    const id = crypto.randomUUID();
    publishConfirmDialogs([...entries, { id, options, pending: false }]);
    return id;
  },
  close(id: string) {
    publishConfirmDialogs(entries.filter((entry) => entry.id !== id || entry.pending));
  },
};
/**
 * Runs the confirmation of the newest dialog: it stays pending (and cannot close) while `onConfirm` runs, is
 * removed on success, and becomes available for a retry after `onError` on failure. A repeated call while
 * pending, or for a dialog that is not the newest, does nothing.
 */
export function confirmDialog(id: string) {
  const active = entries.at(-1);
  if (active?.id !== id || active.pending) {
    return;
  }
  const { onConfirm, onError } = active.options;
  publishConfirmDialogs(entries.map((entry) => (entry.id === id ? { ...entry, pending: true } : entry)));
  return Promise.resolve()
    .then(onConfirm)
    .then(
      () => {
        publishConfirmDialogs(entries.filter((entry) => entry.id !== id));
      },
      (error) => {
        publishConfirmDialogs(entries.map((entry) => (entry.id === id ? { ...entry, pending: false } : entry)));
        onError?.(error);
      },
    );
}
