import type { Meta, StoryObj } from '@storybook/nextjs';
import { useTranslations } from 'next-intl';
import { expect, within } from 'storybook/test';
import { ManifestProvider } from '@/lib/contexts/ManifestContext';
import { DEFAULT_SITE_SETTINGS_VIEW } from '@/lib/types/site-setting/config';
import { PageLoader, type PageLoaderProps } from './PageLoader';

type PreviewProps = PageLoaderProps & {
  loaderImageSrc: string;
  phase: 'default' | 'connecting' | 'loading' | 'rendering';
};
function SiteLoaderPreview({ loaderImageSrc, phase, ...props }: PreviewProps) {
  const t = useTranslations('map.loading');
  return (
    <ManifestProvider
      manifest={{
        settings: {
          ...DEFAULT_SITE_SETTINGS_VIEW,
          favicon_asset_set: null,
          site_og_image_url: null,
          loader_urls: loaderImageSrc ? [loaderImageSrc] : [],
        },
        menus: { $typeName: 'api.open.v1.Menus', header: [], secondary: [], footer: [], avatarDropdown: [] },
      }}
    >
      <PageLoader {...props} message={phase === 'default' ? props.message : t(phase)} />
    </ManifestProvider>
  );
}
const meta: Meta<typeof SiteLoaderPreview> = {
  title: 'Feature/Site/PageLoader',
  component: SiteLoaderPreview,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The production site controller and Core view, with a local ManifestProvider fixture. Change phase, locale and loaderImageSrc in Controls to compare generic text and the map phase contract with the same configured image. The local asset is static; an observed public GIF can be supplied without committing its production URL. Rendering is a supported message, not an observed map runtime transition.',
      },
    },
  },
  decorators: [
    (Story, { args }) => (
      <div style={{ position: 'relative', height: args.placement === 'flow' ? 'auto' : 320 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    loaderImageSrc: { control: 'text' },
    phase: { control: 'select', options: ['default', 'connecting', 'loading', 'rendering'] },
    contrast: { control: 'radio', options: ['standard', 'inverse'] },
    placement: { control: 'radio', options: ['fill', 'flow'] },
  },
  args: {
    loaderImageSrc: '/storybook/media/video-poster.jpg',
    phase: 'default',
  },
};
export default meta;
type Story = StoryObj<typeof SiteLoaderPreview>;

export const Default: Story = {};
export const MapPhase: Story = { args: { phase: 'loading' } };
export const WithoutImage: Story = { args: { loaderImageSrc: '' } };
export const FailedImage: Story = { args: { loaderImageSrc: '/storybook/media/missing-loader.gif' } };
export const FlowRegion: Story = {
  args: { placement: 'flow', minHeight: 200 },
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole('status');
    await expect(status).toHaveAttribute('data-placement', 'flow');
    await expect(getComputedStyle(status).position).toBe('relative');
    await expect(status.getBoundingClientRect().height).toBeGreaterThanOrEqual(200);
  },
};
