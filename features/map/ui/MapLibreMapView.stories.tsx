import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import { withFeatureLabels } from '@/stories/feature-localization';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, waitFor } from 'storybook/test';
import { PageLoader } from '@/features/site/PageLoader';
import { ManifestProvider } from '@/lib/contexts/ManifestContext';
import { DEFAULT_SITE_SETTINGS_VIEW } from '@/lib/types/site-setting/config';

import { MapLibreMapView, MapUnavailableView } from './MapLibreMapView';

const meta: Meta<typeof MapLibreMapView> = {
  title: 'Feature/Map/MapLibreMapView',
  component: MapLibreMapView,
  decorators: [
    withFeatureLabels({
      project: (args, t) => ({
        closeDirectionsLabel: t('common.actions.close'),
        loadingSurface: <PageLoader height="100%" minHeight={0} size="sm" message={t('map.loading.rendering')} />,
        errorSurface: args.errorSurface ? (
          <MapUnavailableView
            message={t('mapView.renderUnavailable')}
            retryLabel={t('common.loadMore.retry')}
            onRetry={() => {}}
          />
        ) : undefined,
        printPreviewAlt: `${t('common.labels.map')} · ${t('common.labels.preview')}`,
        directions: args.directions
          ? { ...(args.directions as Record<string, unknown>), title: t('map.directions') }
          : null,
        mapSurface: (
          <div
            style={{
              display: 'grid',
              width: '100%',
              height: '100%',
              placeItems: 'center',
              background: 'var(--geul-surface-hover)',
              color: 'var(--geul-text-primary)',
            }}
          >
            {t('common.labels.map')}
          </div>
        ),
        backgroundColor: 'var(--geul-background)',
      }),
    }),
  ],
  tags: ['surface-fixture'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Production Map View surface with the existing site PageLoader in its loading slot. The public MapLibreMap controller resolves localized connecting/loading/rendering stages and settings.loader_urls through this same loader. Pending prose has no card/background. The configured-image example supplies a local image through ManifestProvider; it does not exercise a live tile service, settings persistence or authored GIF content.',
      },
    },
  },
  args: {
    height: 420,
    backgroundColor: '#e2e8f0',
    mapSurface: (
      <div
        style={{
          display: 'grid',
          width: '100%',
          height: '100%',
          placeItems: 'center',
          background: 'linear-gradient(135deg, #dbeafe, #dcfce7)',
        }}
      >
        Map runtime slot
      </div>
    ),
    isReady: true,
    loadingSurface: <div>Loading map…</div>,
    attributionItems: [
      { label: '© OpenMapTiles', href: 'https://openmaptiles.org' },
      {
        label: '© OpenStreetMap contributors',
        href: 'https://www.openstreetmap.org/copyright',
      },
    ],
    directions: {
      title: 'Directions',
      options: [
        { id: 'google', label: 'Google Maps', icon: 'google' },
        { id: 'naver', label: 'Naver Maps', icon: 'naver' },
      ],
    },
    closeDirectionsLabel: 'Close',
    onCloseDirections: () => {},
    onSelectProvider: () => {},
    printImageUrl: null,
    printPreviewAlt: 'Map preview',
    containerRef: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof MapLibreMapView>;

export const Directions: Story = {
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const provider = [...doc.querySelectorAll('button')].find((button) => button.textContent?.includes('Google Maps'));
    expect([...provider!.querySelectorAll('path')].map((path) => path.getAttribute('fill'))).toEqual([
      '#4285F4',
      '#34A853',
      '#FBBC05',
      '#EA4335',
    ]);
    const naver = [...doc.querySelectorAll('button')].find((button) => button.textContent?.includes('Naver Maps'));
    expect(naver?.querySelector('svg')?.getAttribute('fill')).toBe('#03C75A');
    await waitFor(() => expect(provider!).toBeVisible());
    const dialog = provider!.closest('[role="dialog"]')!;
    expect(dialog.closest('[data-density]')).toHaveAttribute('data-density', 'compact');
    for (const command of [provider!, naver!]) {
      expect(command).toHaveAttribute('data-control-size', 'xs');
      const glyph = command.querySelector('svg')!.getBoundingClientRect();
      const control = command.getBoundingClientRect();
      expect(Math.abs((glyph.top + glyph.bottom) / 2 - (control.top + control.bottom) / 2)).toBeLessThan(1);
    }
  },
  render: function InteractiveDirections(args) {
    const [opened, setOpened] = useState(true);
    const t = useTranslations('map');
    return (
      <>
        <Button onClick={() => setOpened(true)}>{t('directions')}</Button>
        <MapLibreMapView
          {...args}
          directions={opened ? args.directions : null}
          onCloseDirections={() => setOpened(false)}
          onSelectProvider={(value) => {
            window.open(
              value === 'google'
                ? 'https://www.google.com/maps/dir/?api=1&destination=37.5665,126.9780'
                : 'https://map.naver.com/p/directions/-/14135126,4518365,Seoul/-/transit',
              '_blank',
              'noopener,noreferrer',
            );
            setOpened(false);
          }}
        />
      </>
    );
  },
};

async function inspectLoadingSurface(canvasElement: HTMLElement) {
  const surface = canvasElement.querySelector('[data-map-loading-surface]')!;
  const loader = surface.querySelector('[data-core-page-loader]')!;
  await expect(loader).toHaveAttribute('role', 'status');
  await expect(loader.parentElement).toBe(surface);
  await expect(getComputedStyle(surface).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  const text = loader.querySelector('[data-core-typography="text"]')!;
  await expect(text).toHaveAttribute('data-size', 'xs');
  await expect(getComputedStyle(text).backgroundColor).toBe('rgba(0, 0, 0, 0)');
}

export const Loading: Story = {
  args: {
    isReady: false,
    directions: null,
  },
  play: async ({ canvasElement }) => {
    await inspectLoadingSurface(canvasElement);
  },
};

export const Unavailable: Story = {
  args: {
    isReady: false,
    directions: null,
    errorSurface: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toBeVisible();
    await expect(canvas.getByRole('button')).toBeVisible();
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
  },
};

export const ConfiguredSiteImage: Story = {
  ...Loading,
  decorators: [
    (Story) => (
      <ManifestProvider
        manifest={{
          settings: {
            ...DEFAULT_SITE_SETTINGS_VIEW,
            favicon_asset_set: null,
            site_og_image_url: null,
            loader_urls: ['/storybook/media/video-poster.jpg'],
          },
          menus: { $typeName: 'api.open.v1.Menus', header: [], secondary: [], footer: [], avatarDropdown: [] },
        }}
      >
        <Story />
      </ManifestProvider>
    ),
  ],
  play: async ({ canvasElement }) => {
    await inspectLoadingSurface(canvasElement);
    const image = canvasElement.querySelector('[data-map-loading-surface] img')!;
    await expect(image).toHaveAttribute('src');
    await expect(image.getAttribute('src')).toContain('video-poster.jpg');
  },
};
