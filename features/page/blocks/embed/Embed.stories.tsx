import { LayoutGrid as DsLayoutGrid } from '@/components/core/Layout';
import { useEffect, useState } from 'react';
import { createTranslator, useLocale } from 'next-intl';
import { expect, userEvent, within } from 'storybook/test';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';

import type { Meta, StoryObj } from '@storybook/nextjs';
import { InputSizeProvider } from '@/components/core/Input';
import { EmbedFrame } from './EmbedFrame';
import { EmbedSettingsForm } from './SettingsForm';
import { parseEmbedProps } from './schema';
import { DEFAULT_DOCUMENT_LAYOUT } from '@/features/document-layout';
import { PageContentView } from '@/features/page/PageView/PageContentView';

const meta: Meta<typeof EmbedFrame> = {
  title: 'Feature/Page/Embed',
  component: EmbedFrame,
  parameters: { canvasInset: 'none', layout: 'padded' },
  args: {
    props: parseEmbedProps({ uri: 'https://example.com', title: 'Embedded source', height: '480' }),
    preview: true,
  },
};
export default meta;
type Story = StoryObj<typeof EmbedFrame>;
export const Frame: Story = {};
export const Empty: Story = { args: { props: parseEmbedProps({}) } };
export const Invalid: Story = { args: { props: parseEmbedProps({ uri: 'http://insecure.example' }) } };
export const Mobile: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: '100%' }}>
        <Story />
      </div>
    ),
  ],
};
export const Dark: Story = {};
function Settings({ readonly = false }: { readonly?: boolean }) {
  const [props, setProps] = useState(parseEmbedProps({ uri: 'https://example.com' }));
  const update = (next: Record<string, unknown>) => setProps((current) => parseEmbedProps({ ...current, ...next }));
  return (
    <InputSizeProvider size="xs">
      <EmbedSettingsForm
        props={props}
        allowSharedEdits={!readonly}
        updateSharedProps={update}
        updateLocalizedProps={update}
      />
    </InputSizeProvider>
  );
}
export const SettingsPanel: Story = { render: () => <Settings /> };
export const SettingsMobile: Story = {
  render: () => (
    <div style={{ width: 320, maxWidth: '100%' }}>
      <Settings />
    </div>
  ),
};
export const SettingsDark: Story = { render: () => <Settings /> };
export const Readonly: Story = { render: () => <Settings readonly /> };

function CombinedEditor({ module = false }: { module?: boolean }) {
  const [props, setProps] = useState(
    parseEmbedProps({ uri: 'https://example.com', title: 'Embedded source', heightMode: 'auto', height: '480' }),
  );
  useEffect(() => {
    if (module) {
      setProps((current) => ({ ...current, uri: `${window.location.origin}/fixtures/embed-tool.js` }));
    }
  }, [module]);
  const update = (next: Record<string, unknown>) => setProps((current) => parseEmbedProps({ ...current, ...next }));
  return (
    <DsLayoutGrid columns={{ base: 1, md: 2 }} gap="lg">
      <EmbedSettingsForm props={props} updateSharedProps={update} updateLocalizedProps={update} />
      <div style={{ ...{ minWidth: 0 } }}>
        <EmbedFrame props={props} preview />
      </div>
    </DsLayoutGrid>
  );
}
export const Combined: Story = { render: () => <CombinedEditor /> };
export const CombinedModule: Story = { render: () => <CombinedEditor module /> };
export const CombinedModuleDark: Story = { render: () => <CombinedEditor module /> };
export const CombinedModuleMobile: Story = {
  render: () => (
    <div style={{ width: 320, maxWidth: '100%' }}>
      <CombinedEditor module />
    </div>
  ),
};

export const DirectToolContentControls: Story = {
  parameters: { layout: 'fullscreen' },
  args: { props: parseEmbedProps({ uri: '', title: 'Direct module tool' }) },
  argTypes: { props: { control: 'object' } },
  render: function ContentControls({ props }) {
    const locale = useLocale();
    const [uri, setUri] = useState(props.uri);
    useEffect(() => setUri(props.uri || `${window.location.origin}/fixtures/embed-tool.js`), [props.uri]);
    return (
      <div style={{ padding: 16 }}>
        <PageContentView
          pathname="/page/tool"
          requestedLocale={locale}
          page={{
            title: '',
            showTitle: false,
            blockMedia: [],
            documentLayout: DEFAULT_DOCUMENT_LAYOUT,
            content: [
              {
                id: 'tool',
                kind: 'embed',
                settings: {},
                richText: null,
                columns: [],
                props: parseEmbedProps({ ...props, uri }),
              },
            ],
            localizationInfo: {
              requestedLocale: locale,
              displayedLocale: 'en',
              sourceLocale: 'en',
              availableLocales: ['en', 'ko'],
              isFallback: false,
              isOriginal: true,
              machineGenerated: false,
              fallbackReason: 0,
            },
          }}
        />
      </div>
    );
  },
};

export const SettingsCompact: Story = {
  render: () => (
    <div style={{ width: 260, maxWidth: '100%' }}>
      <Settings />
    </div>
  ),
};

export const KeyboardPermissions: Story = {
  render: () => <Settings />,
  tags: ['a11y-author'],
  play: async ({ canvasElement, globals, step }) => {
    const locale = normalizeLocale(globals.locale) ?? DEFAULT_LOCALE;
    const { default: messages } = await import(`../../../../messages/${locale}.json`);
    const t = createTranslator({ locale, messages, namespace: 'pageEditor.embed' });
    const canvas = within(canvasElement);
    const permissions = [
      ['scriptsLabel', 'scriptsDescription'],
      ['storageLabel', 'storageDescription'],
      ['formsLabel', 'formsDescription'],
      ['downloadsLabel', 'downloadsDescription'],
      ['popupsLabel', 'popupsDescription'],
      ['microphoneLabel', 'microphoneDescription'],
      ['speakerSelectionLabel', 'speakerSelectionDescription'],
      ['fullscreenLabel', 'fullscreenDescription'],
    ];
    await step('Author identifies all iframe permissions and toggles each with Space', async () => {
      await expect(canvas.getAllByRole('checkbox')).toHaveLength(8);
      for (const [label, description] of permissions) {
        const checkbox = canvas.getByRole('checkbox', { name: t(label) }) as HTMLInputElement;
        await expect(checkbox).toHaveAccessibleDescription(t(description));
        for (let index = 0; index < 100 && canvasElement.ownerDocument.activeElement !== checkbox; index += 1) {
          await userEvent.tab();
        }
        await expect(checkbox).toHaveFocus();
        const previous = checkbox.checked;
        await userEvent.keyboard(' ');
        await expect(checkbox.checked).toBe(!previous);
        await expect(checkbox).toHaveFocus();
      }
    });
  },
};
