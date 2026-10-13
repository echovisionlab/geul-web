'use client';
import { preloadDrawer } from './Drawer/OnDemandDrawer';
import { preloadDropdownMenu } from './DropdownMenu/OnDemandDropdownMenu';
import { preloadConfirmDialogs } from './Modal/confirm-dialogs';
import { preloadNotificationRegion } from './Notification/NotificationHost';
import { preloadTooltip } from './Tooltip/OnDemandTooltip';

/**
 * Loads every on-demand Core overlay surface (drawer, menu, tooltip, confirmation and notification
 * renderers). Afterwards the on-demand components render synchronously, exactly like the eager
 * ones. Storybook's preview loader and tests that assert on overlays call this; applications
 * normally rely on hover/focus/press preloading instead.
 */
export async function preloadOnDemandOverlays() {
  await Promise.all([
    preloadDrawer(),
    preloadDropdownMenu(),
    preloadTooltip(),
    preloadConfirmDialogs(),
    preloadNotificationRegion(),
  ]);
}
