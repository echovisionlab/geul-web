import type { Decorator } from '@storybook/nextjs';
import { ManifestProvider } from '@/lib/contexts/ManifestContext';
import { DEFAULT_SITE_SETTINGS_VIEW } from '@/lib/types/site-setting/config';

/** Rawsector's red label: stacked logo sized by the file (56px), S2 symbol tile for compact places. Vector authority: /Volumes/dev/rawsector. */
export const withStackedBrand: Decorator = (Story) => (
  <ManifestProvider
    manifest={{
      settings: {
        ...DEFAULT_SITE_SETTINGS_VIEW,
        site_origin: 'https://www.rawsector.com',
        site_title: 'rawsector',
        favicon_asset_set: null,
        site_og_image_url: null,
        logo_full_light_url: '/storybook/media/rawsector-label.svg',
        logo_full_dark_url: '/storybook/media/rawsector-label.svg',
        logo_symbol_light_url: '/storybook/media/rawsector-label-symbol.svg',
        logo_symbol_dark_url: '/storybook/media/rawsector-label-symbol.svg',
      },
      menus: { $typeName: 'api.open.v1.Menus', header: [], secondary: [], footer: [], avatarDropdown: [] },
    }}
  >
    <Story />
  </ManifestProvider>
);
