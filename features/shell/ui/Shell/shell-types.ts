import type { ReactNode } from 'react';

export interface ShellViewNavigationItem {
  id: string;
  label: string;
  href: string;
  /** Current-route state. The production shell derives it from the client pathname instead. */
  active: boolean;
  openInNewTab: boolean;
  children: ShellViewNavigationItem[];
}

export interface ShellViewUser {
  kind: 'snapshot' | 'authenticated';
  name: string;
  email: string | null;
  imageUrls: {
    compact: string | null;
    mobile: string | null;
    detail: string | null;
  };
}

export interface ShellViewFooter {
  siteTitle: string;
  description: string | null;
  copyright: string | null;
  taxId: string | null;
  companyAddress: string | null;
  version: string;
  showChangelog: boolean;
}

export interface ShellViewLabels {
  navigation: string;
  toggleNavigation: string;
  close: string;
  search: string;
  searchTooltip: string;
  signIn: string;
  account: string;
  logOut: string;
  toggleColorScheme: string;
  themeTooltip: string;
  cookieSettings: string;
  changelog: string;
  newsletter: string;
  footerSiteInfo: string;
  footerLinks: string;
  footerSocialMedia: string;
}

export interface ShellViewEvents {
  onToggleNavigation: () => void;
  onOpenUserMenu: () => void;
  onCloseUserMenu: () => void;
  onSearch: () => void;
  /** Pointer or focus reached a search trigger; start loading search (optional). */
  onSearchIntent?: () => void;
  onToggleColorScheme: () => void;
  onSignOut: () => void | Promise<void>;
  onOpenCookieSettings: () => void;
  onNavigate: (href: string) => void;
}

export interface ShellViewSlots {
  logo: ReactNode;
  printHeader: ReactNode;
  printWatermark: ReactNode;
  languageDesktop: ReactNode;
  /** Shown in the navigation drawer; the phone header has no language control. */
  languageNavigation: ReactNode;
  languageFooterDesktop: ReactNode;
  languageFooterMobile: ReactNode;
  socialLinks: ReactNode;
}

export interface ShellViewProps {
  children: ReactNode;
  loginHref: string;
  navigationOpened: boolean;
  userMenuOpened: boolean;
  themeMode: 'light' | 'dark' | null;
  user: ShellViewUser | null;
  headerItems: ShellViewNavigationItem[];
  secondaryItems: ShellViewNavigationItem[];
  footerItems: ShellViewNavigationItem[];
  accountItems: ShellViewNavigationItem[];
  footer: ShellViewFooter;
  labels: ShellViewLabels;
  events: ShellViewEvents;
  slots: ShellViewSlots;
}

/** Labels that depend on client state (theme, platform); the rest of `ShellViewLabels` is static. */
export type ShellDynamicLabelKey = 'searchTooltip' | 'themeTooltip';
export type ShellStaticLabels = Omit<ShellViewLabels, ShellDynamicLabelKey>;

/**
 * Serializable input of the server-rendered layout. Interactive state (open panels, session user,
 * theme, current route, login return path, role-gated links) comes from the client shell state.
 */
export interface ShellLayoutProps {
  children: ReactNode;
  headerItems: ShellViewNavigationItem[];
  secondaryItems: ShellViewNavigationItem[];
  footerItems: ShellViewNavigationItem[];
  accountItems: ShellViewNavigationItem[];
  footer: Omit<ShellViewFooter, 'showChangelog'>;
  labels: ShellStaticLabels;
  slots: ShellViewSlots;
}

/** Client state the shell islands read: provided by `ShellRuntime` (app) or `ShellView` (stories, tests). */
export interface ShellState {
  navigationOpened: boolean;
  userMenuOpened: boolean;
  themeMode: 'light' | 'dark' | null;
  user: ShellViewUser | null;
  loginHref: string;
  showChangelog: boolean;
  isItemActive: (item: ShellViewNavigationItem) => boolean;
  labels: Pick<ShellViewLabels, ShellDynamicLabelKey>;
  events: ShellViewEvents;
}
