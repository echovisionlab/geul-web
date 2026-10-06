import { useEffect, useState } from 'react';
import { Box, SimpleGrid } from '@mantine/core';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { EmbedFrame } from './EmbedFrame';
import { EmbedSettingsForm } from './SettingsForm';
import { parseEmbedProps } from './schema';

const meta: Meta<typeof EmbedFrame> = {
  title: 'Feature/Page/Embed',
  component: EmbedFrame,
  parameters: { layout: 'padded' },
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
export const Dark: Story = { globals: { theme: 'dark' } };
function Settings({ readonly = false }: { readonly?: boolean }) {
  const [props, setProps] = useState(parseEmbedProps({ uri: 'https://example.com' }));
  const update = (next: Record<string, unknown>) => setProps((current) => parseEmbedProps({ ...current, ...next }));
  return (
    <EmbedSettingsForm
      props={props}
      allowSharedEdits={!readonly}
      updateSharedProps={update}
      updateLocalizedProps={update}
    />
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
export const SettingsDark: Story = { render: () => <Settings />, globals: { theme: 'dark' } };
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
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
      <EmbedSettingsForm props={props} updateSharedProps={update} updateLocalizedProps={update} />
      <Box style={{ minWidth: 0 }}>
        <EmbedFrame props={props} preview />
      </Box>
    </SimpleGrid>
  );
}
export const Combined: Story = { render: () => <CombinedEditor /> };
export const CombinedModule: Story = { render: () => <CombinedEditor module /> };
export const CombinedModuleDark: Story = { render: () => <CombinedEditor module />, globals: { theme: 'dark' } };
export const CombinedModuleMobile: Story = {
  render: () => (
    <div style={{ width: 320, maxWidth: '100%' }}>
      <CombinedEditor module />
    </div>
  ),
};

export const SettingsCompact: Story = {
  render: () => (
    <div style={{ width: 260, maxWidth: '100%' }}>
      <Settings />
    </div>
  ),
};
