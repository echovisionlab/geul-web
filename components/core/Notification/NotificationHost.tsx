'use client';
import { useSyncExternalStore } from 'react';
import { onDemandModule, useOnDemandModule } from '../on-demand-module';
import { notificationQueue } from './notifications';

const region = onDemandModule(() => import('./NotificationRegion'));
const subscribe = (listener: () => void) => notificationQueue.subscribe(listener);
// A new snapshot on every queue change: a new notice retries a region chunk that failed to load.
const visibleNotices = () => notificationQueue.visibleToasts;
const noNotices: typeof notificationQueue.visibleToasts = [];
const serverNotices = () => noNotices;

export type NotificationHostLoading = 'on-demand' | 'eager';
export interface NotificationHostProps {
  closeLabel: string;
  /**
   * `on-demand` (default) keeps the toast region, its live announcer and React Aria toast code out
   * of the first load; they load when the first notice is queued. `notifications.show()` before that
   * waits in the queue (timers start when the notice is displayed). `eager` loads the region on mount,
   * for Storybook and tests that assert on an empty region.
   */
  loading?: NotificationHostLoading;
}

/** Application notification host. Mount once near the root. */
export function NotificationHost({ closeLabel, loading = 'on-demand' }: NotificationHostProps) {
  const notices = useSyncExternalStore(subscribe, visibleNotices, serverNotices);
  const loaded = useOnDemandModule(region, notices.length > 0 || loading === 'eager', notices);
  return loaded ? <loaded.NotificationRegion closeLabel={closeLabel} /> : null;
}

/** Starts loading the toast region, for example before an action that is likely to report a result. */
export const preloadNotificationRegion = region.preload;
