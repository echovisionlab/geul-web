'use client';
import { useSyncExternalStore } from 'react';
import { onDemandModule, useOnDemandModule } from '../on-demand-module';
import { getConfirmDialogs, getServerConfirmDialogs, subscribeConfirmDialogs } from './confirm-dialog-store';
export { confirmDialogs } from './confirm-dialog-store';
export type { ConfirmDialogOptions } from './confirm-dialog-store';

const stack = onDemandModule(() => import('./ConfirmDialogStack'));

export type ConfirmDialogHostLoading = 'on-demand' | 'eager';
export interface ConfirmDialogHostProps {
  /**
   * `on-demand` (default) keeps the modal, dialog and focus-scope code out of the first load. The first
   * `confirmDialogs.open()` stays queued while the renderer loads and the dialog opens when it arrives;
   * the trigger keeps focus until then, so the dialog restores focus to it on close. `eager` loads the
   * renderer on mount (Storybook, tests).
   */
  loading?: ConfirmDialogHostLoading;
}

/** Application confirmation host. Mount once near the root. */
export function ConfirmDialogHost({ loading = 'on-demand' }: ConfirmDialogHostProps = {}) {
  // A new snapshot on every open/close: a new request retries a renderer chunk that failed to load.
  const dialogs = useSyncExternalStore(subscribeConfirmDialogs, getConfirmDialogs, getServerConfirmDialogs);
  const loaded = useOnDemandModule(stack, dialogs.length > 0 || loading === 'eager', dialogs);
  return loaded ? <loaded.ConfirmDialogStack /> : null;
}

/** Starts loading the confirmation renderer, for example when a destructive action is hovered or focused. */
export const preloadConfirmDialogs = stack.preload;
