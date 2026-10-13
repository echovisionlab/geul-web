'use client';

import { type ReactNode, useCallback, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useDisclosure, useMounted, useOs } from '@mantine/hooks';
import { openPostSpotlight, preloadPostSpotlight } from '@/features/post/PostSpotlight/post-spotlight-trigger';
import { signOut, useSession } from '@/lib/auth/client';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import type { UserDisplaySnapshot } from '@/lib/auth/user-display-cookie';
import { COOKIE_CONSENT_OPEN_EVENT } from '@/lib/cookie-consent';
import { useColorScheme, useComputedColorScheme } from '@/lib/providers/DesignSystemProvider';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import { isMenuUrlActive } from '@/lib/utils/menu';
import { ShellStateProvider } from './ui/Shell/shell-state';
import type { ShellState, ShellViewNavigationItem, ShellViewUser } from './ui/Shell/shell-types';

/** Server-translated variants of the labels that depend on client state. */
export interface ShellRuntimeLabels {
  searchTooltipMac: string;
  searchTooltipOther: string;
  lightMode: string;
  darkMode: string;
  toggleColorScheme: string;
}

function buildShellUser(
  sessionUser: {
    nickname: string;
    email: string | null;
    image: string | null | undefined;
  } | null,
  sessionPending: boolean,
  initialUserSnapshot: UserDisplaySnapshot | null | undefined,
): ShellViewUser | null {
  const user = sessionUser
    ? {
        kind: 'authenticated' as const,
        name: sessionUser.nickname,
        email: sessionUser.email,
        image: sessionUser.image,
      }
    : sessionPending && initialUserSnapshot
      ? {
          kind: 'snapshot' as const,
          name: initialUserSnapshot.name,
          email: null,
          image: initialUserSnapshot.image,
        }
      : null;
  if (!user) {
    return null;
  }
  return {
    kind: user.kind,
    name: user.name,
    email: user.email,
    imageUrls: {
      compact: buildManagedImageUrl(user.image, MANAGED_IMAGE_PRESET.AVATAR_XS) ?? null,
      mobile: buildManagedImageUrl(user.image, MANAGED_IMAGE_PRESET.AVATAR_SM) ?? null,
      detail: buildManagedImageUrl(user.image, MANAGED_IMAGE_PRESET.AVATAR_MD) ?? null,
    },
  };
}

/**
 * Client state of the server-rendered public shell: navigation and account panels, session user
 * (with the cookie snapshot while the session resolves), theme, current route, login return path
 * and role-gated footer links. Provides it to the shell islands.
 */
export function ShellRuntime({
  children,
  initialUserSnapshot,
  labels,
}: {
  children: ReactNode;
  initialUserSnapshot?: UserDisplaySnapshot | null;
  labels: ShellRuntimeLabels;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigationOpened, { toggle: toggleNavigation, close: closeNavigation }] = useDisclosure();
  const [userMenuOpened, { open: openUserMenu, close: closeUserMenu }] = useDisclosure();
  const { toggleColorScheme } = useColorScheme();
  const computedColorScheme = useComputedColorScheme();
  const mounted = useMounted();
  const { data: session, isPending: isSessionPending } = useSession();
  const os = useOs();
  const user = buildShellUser(
    session?.onboarded ? session.user : null,
    isSessionPending,
    session?.onboarded === false ? null : initialUserSnapshot,
  );
  const queryString = searchParams?.toString();
  const currentPath = queryString ? `${pathname}?${queryString}` : pathname;
  useEffect(() => {
    closeNavigation();
  }, [pathname, closeNavigation]);
  const isItemActive = useCallback((item: ShellViewNavigationItem) => isMenuUrlActive(pathname, item.href), [pathname]);
  const themeMode = mounted ? computedColorScheme : null;
  const state: ShellState = {
    navigationOpened,
    userMenuOpened,
    themeMode,
    user,
    loginHref: buildLoginRedirectHref(currentPath),
    showChangelog: session?.user.role === 'admin' || session?.user.role === 'author',
    isItemActive,
    labels: {
      searchTooltip: os === 'macos' ? labels.searchTooltipMac : labels.searchTooltipOther,
      themeTooltip:
        themeMode === 'dark' ? labels.lightMode : themeMode === 'light' ? labels.darkMode : labels.toggleColorScheme,
    },
    events: {
      onToggleNavigation: toggleNavigation,
      onOpenUserMenu: openUserMenu,
      onCloseUserMenu: closeUserMenu,
      onSearch: openPostSpotlight,
      onSearchIntent: preloadPostSpotlight,
      onToggleColorScheme: toggleColorScheme,
      onSignOut: () => {
        closeUserMenu();
        signOut();
      },
      onOpenCookieSettings: () => {
        window.dispatchEvent(new Event(COOKIE_CONSENT_OPEN_EVENT));
      },
      onNavigate: () => {
        closeNavigation();
        closeUserMenu();
      },
    },
  };
  return <ShellStateProvider value={state}>{children}</ShellStateProvider>;
}
