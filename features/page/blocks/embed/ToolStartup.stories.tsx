import type { Meta, StoryObj } from '@storybook/nextjs';
import { useEffect, useState } from 'react';
import { createTranslator, useLocale } from 'next-intl';
import { expect, within } from 'storybook/test';
import { DEFAULT_DOCUMENT_LAYOUT } from '@/features/document-layout';
import { PageContentView } from '@/features/page/PageView/PageContentView';
import { ManifestProvider } from '@/lib/contexts/ManifestContext';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';
import { DEFAULT_SITE_SETTINGS_VIEW } from '@/lib/types/site-setting/config';
import { EmbedFrame } from './EmbedFrame';
import { parseEmbedProps } from './schema';

interface ToolStartupProps {
  startup: 'pending' | 'failed' | 'ready';
  surface: 'page' | 'frame';
  loaderImageSrc: string;
  mobile: boolean;
}

function ToolStartup({ startup, surface, loaderImageSrc, mobile }: ToolStartupProps) {
  const locale = useLocale();
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  if (!origin) {
    return null;
  }
  const uri = `${origin}/fixtures/${startup === 'ready' ? 'embed-tool.js' : `embed-tool-startup.js?state=${startup}`}`;
  const props = parseEmbedProps({ uri, title: 'Tool startup fixture' });
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
      <div style={{ width: mobile ? 320 : '100%', maxWidth: '100%' }}>
        {surface === 'frame' ? (
          <EmbedFrame props={props} />
        ) : (
          <PageContentView
            pathname="/tools/portadj"
            requestedLocale={locale}
            page={{
              title: '',
              showTitle: false,
              blockMedia: [],
              documentLayout: DEFAULT_DOCUMENT_LAYOUT,
              content: [{ id: 'tool', kind: 'embed', settings: {}, richText: null, columns: [], props }],
            }}
          />
        )}
      </div>
    </ManifestProvider>
  );
}

const meta = {
  title: 'Feature/Page/Tool Startup',
  component: ToolStartup,
  parameters: {
    layout: 'fullscreen',
    canvasInset: 'none',
    docs: {
      description: {
        component:
          'Production PageContentView → EmbedFrame → ToolModule → PageLoader, with a local ManifestProvider. Only the external module mount boundary is a fixture: pending waits until unmount aborts it; failed rejects mount; ready uses the unchanged embed-tool.js. Change startup in Controls to replace the module and cancel a pending mount. The same-origin /fixtures/*.js URLs use the production trust policy. loaderImageSrc accepts an ephemeral Works GIF URL; the default image is a local static asset. Theme and Language toolbars apply to the production components; Mobile constrains the content to 320px. These stories cover mount waiting and rejection, not a stalled module download or real tool requests. In geul-tools/shared/client/module.tsx, mount awaits configuration and stylesheet loading with Promise.all; that producer is outside web source. The parent PageLoader remains until mount settles.',
      },
    },
  },
  argTypes: {
    startup: { control: 'radio', options: ['pending', 'failed', 'ready'] },
    surface: { control: 'radio', options: ['page', 'frame'] },
    loaderImageSrc: { control: 'text' },
    mobile: { control: 'boolean' },
  },
  args: {
    startup: 'pending',
    surface: 'page',
    loaderImageSrc: '/storybook/media/video-poster.jpg',
    mobile: false,
  },
} satisfies Meta<typeof ToolStartup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {
  play: async ({ canvasElement, globals, args }) => {
    const locale = normalizeLocale(globals.locale) ?? DEFAULT_LOCALE;
    const { default: messages } = await import(`../../../../messages/${locale}.json`);
    const t = createTranslator({ locale, messages, namespace: 'pageEditor.embed' });
    const canvas = within(canvasElement);
    if (args.startup === 'failed') {
      await expect(await canvas.findByRole('alert')).toHaveTextContent(t('toolLoadError'));
      await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
    } else if (args.startup === 'pending') {
      await canvas.findByText(t('toolLoading'));
      const status = canvas.getByRole('status');
      await expect(status).toHaveAttribute('data-core-page-loader');
      await expect(status).toHaveAttribute('data-placement', 'flow');
      await expect(status).toHaveTextContent(t('toolLoading'));
      await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
    }
  },
};
export const Failed: Story = { ...Pending, args: { startup: 'failed' } };
export const Ready: Story = { args: { startup: 'ready' } };
export const FramePending: Story = { ...Pending, args: { surface: 'frame' } };
export const FrameFailed: Story = { ...Failed, args: { startup: 'failed', surface: 'frame' } };
export const Mobile: Story = { ...Pending, args: { mobile: true } };
