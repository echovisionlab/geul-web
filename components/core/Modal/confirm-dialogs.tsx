'use client';
import { useCallback, useSyncExternalStore } from 'react';
import { onDemandModule, useOnDemandModuleState } from '../on-demand-module';
import {
  confirmDialogs,
  getConfirmDialogs,
  getServerConfirmDialogs,
  subscribeConfirmDialogs,
} from './confirm-dialog-store';
import { RouteProgressBar } from '../Progress/RouteProgressBar';
import { Alert } from '../Alert';
import { Button } from '../Button';
import { LayoutStack } from '../Layout';
import { DialogActions } from './DialogActions';
import type { ClosedVisualProps } from '../visual-contract';
export { confirmDialogs } from './confirm-dialog-store';
export type { ConfirmDialogOptions } from './confirm-dialog-store';

const stack = onDemandModule(() => import('./ConfirmDialogStack'));

export type ConfirmDialogHostLoading = 'on-demand' | 'eager';
export interface ConfirmDialogLoadErrorLabels {
  message: string;
  retryLabel: string;
}

export interface ConfirmDialogHostProps extends ClosedVisualProps {
  /** App/Feature-owned localized copy for a renderer request that exhausted its retries. */
  loadError: ConfirmDialogLoadErrorLabels;
  /**
   * `on-demand` (default) keeps the modal, dialog and focus-scope code out of the first load. The first
   * `confirmDialogs.open()` stays queued while the renderer loads and the dialog opens when it arrives;
   * the shared progress bar reports this wait without moving focus from the trigger, so the dialog
   * restores focus to it on close. Exhausted retries show `loadError` recovery controls and retain the
   * request until it is explicitly cancelled or confirmed. `eager` loads the renderer on mount
   * (Storybook, tests).
   */
  loading?: ConfirmDialogHostLoading;
}

export interface ConfirmDialogLoadErrorProps extends ClosedVisualProps, ConfirmDialogLoadErrorLabels {
  title: string;
  cancelLabel: string;
  onCancel: () => void;
  onRetry: () => void;
}

/** Recovery for a queued confirmation; retry only reloads its renderer. */
export function ConfirmDialogLoadError({
  title,
  message,
  retryLabel,
  cancelLabel,
  onCancel,
  onRetry,
}: ConfirmDialogLoadErrorProps) {
  const focusRecovery = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      return;
    }
    const trigger = document.activeElement;
    node.focus();
    return () => {
      // Restore before the loaded dialog mounts, so its own focus scope retains the original trigger.
      if (node.contains(document.activeElement) && trigger instanceof HTMLElement && trigger.isConnected) {
        trigger.focus();
      }
    };
  }, []);
  return (
    <Alert tone="danger" title={title} tabIndex={-1} ref={focusRecovery}>
      <LayoutStack>
        {message}
        <DialogActions>
          <Button emphasis="low" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button onClick={onRetry}>{retryLabel}</Button>
        </DialogActions>
      </LayoutStack>
    </Alert>
  );
}

/** Application confirmation host. Mount once near the root. */
export function ConfirmDialogHost({ loading = 'on-demand', loadError }: ConfirmDialogHostProps) {
  // A new snapshot on every open/close: a new request retries a renderer chunk that failed to load.
  const dialogs = useSyncExternalStore(subscribeConfirmDialogs, getConfirmDialogs, getServerConfirmDialogs);
  const renderer = useOnDemandModuleState(stack, dialogs.length > 0 || loading === 'eager', dialogs);
  const loaded = renderer.module;
  const current = dialogs.at(-1);
  return loaded ? (
    <loaded.ConfirmDialogStack />
  ) : current && renderer.status === 'error' ? (
    <ConfirmDialogLoadError
      {...loadError}
      title={current.options.title}
      cancelLabel={current.options.cancelLabel}
      onCancel={() => confirmDialogs.close(current.id)}
      onRetry={renderer.retry}
    />
  ) : current && renderer.status === 'pending' ? (
    <RouteProgressBar phase="loading" aria-label={current.options.title} />
  ) : null;
}

/** Starts loading the confirmation renderer, for example when a destructive action is hovered or focused. */
export const preloadConfirmDialogs = stack.preload;
