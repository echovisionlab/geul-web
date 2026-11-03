'use client';

import type { ShellState, ShellViewNavigationItem, ShellViewProps } from './shell-types';
import { ShellLayout } from './ShellLayout';
import { ShellStateProvider } from './shell-state';

export type {
  ShellViewEvents,
  ShellViewFooter,
  ShellViewLabels,
  ShellViewNavigationItem,
  ShellViewProps,
  ShellViewSlots,
  ShellViewUser,
} from './shell-types';

const itemActive = (item: ShellViewNavigationItem) => item.active;

/**
 * Controlled public shell for Storybook and tests: every state and event is a prop. It renders the
 * same `ShellLayout` as the application, whose `ShellRuntime` derives the state from the session,
 * route and theme on the client while the layout itself renders on the server.
 */
export function ShellView({
  children,
  loginHref,
  navigationOpened,
  userMenuOpened,
  signOutPending,
  themeMode,
  user,
  headerItems,
  secondaryItems,
  footerItems,
  accountItems,
  footer: { showChangelog, ...footer },
  labels: { searchTooltip, themeTooltip, navigationLoadFailed, retryNavigation, ...labels },
  events,
  slots,
}: ShellViewProps) {
  const state: ShellState = {
    navigationOpened,
    userMenuOpened,
    signOutPending,
    themeMode,
    user,
    loginHref,
    showChangelog,
    isItemActive: itemActive,
    labels: { searchTooltip, themeTooltip, navigationLoadFailed, retryNavigation },
    events,
  };
  return (
    <ShellStateProvider value={state}>
      <ShellLayout
        headerItems={headerItems}
        secondaryItems={secondaryItems}
        footerItems={footerItems}
        accountItems={accountItems}
        footer={footer}
        labels={labels}
        slots={slots}
      >
        {children}
      </ShellLayout>
    </ShellStateProvider>
  );
}
