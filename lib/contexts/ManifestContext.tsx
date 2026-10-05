'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Menus } from '@echovisionlab/geul-proto/public/manifest_pb.ts';
import type { Manifest } from '@/lib/queries/manifest';
import { DEFAULT_SITE_SETTINGS_VIEW, type SiteSettingsView } from '@/lib/types/site-setting/config';

interface ManifestContextValue {
  settings: SiteSettingsView;
  menus: Menus;
  socialLinks: ReactNode;
}

const DEFAULT_MENUS: Menus = {
  $typeName: 'api.open.v1.Menus',
  header: [],
  secondary: [],
  footer: [],
  avatarDropdown: [],
};

const ManifestContext = createContext<ManifestContextValue>({
  settings: DEFAULT_SITE_SETTINGS_VIEW,
  menus: DEFAULT_MENUS,
  socialLinks: null,
});

interface ManifestProviderProps {
  children: ReactNode;
  manifest?: Manifest;
  socialLinks?: ReactNode;
}

export function ManifestProvider({ children, manifest, socialLinks = null }: ManifestProviderProps) {
  const settings: SiteSettingsView = {
    ...DEFAULT_SITE_SETTINGS_VIEW,
    ...manifest?.settings,
  };

  const menus: Menus = manifest?.menus ?? DEFAULT_MENUS;

  return <ManifestContext.Provider value={{ settings, menus, socialLinks }}>{children}</ManifestContext.Provider>;
}

export function useSiteSettings() {
  const { settings } = useContext(ManifestContext);
  return { settings };
}

export function useMenus() {
  const { menus } = useContext(ManifestContext);
  return menus;
}

/** Server-prepared footer content; no client icon catalog is required. */
export function useSiteSocialLinks() {
  return useContext(ManifestContext).socialLinks;
}
