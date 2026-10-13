import { TabsPreview } from '@/stories/shared/ControlPreviews';
import { LayoutStack as StoryLayoutStack, LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';

import { localizedRender, localizeFixtureTree, useStorybookText } from '@/.storybook/fixture-i18n';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { Tabs } from './Tabs';

function TabsExample({ appearance = 'line' }: { appearance?: 'line' | 'outline' | 'pills' }) {
  const text = useStorybookText();
  const [value, setValue] = useState('overview');

  return localizeFixtureTree(
    <Tabs
      value={value}
      onChange={(next) => {
        if (next) {
          setValue(next);
        }
      }}
      appearance={appearance}
    >
      <Tabs.List aria-label="Project views">
        <Tabs.Tab value="overview">Overview</Tabs.Tab>
        <Tabs.Tab value="activity">Activity</Tabs.Tab>
        <Tabs.Tab value="settings">Settings</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="overview" paddingTop="md">
        Overview content
      </Tabs.Panel>
      <Tabs.Panel value="activity" paddingTop="md">
        Activity content
      </Tabs.Panel>
      <Tabs.Panel value="settings" paddingTop="md">
        Settings content
      </Tabs.Panel>
    </Tabs>,
    text,
  );
}

const meta: Meta<typeof Tabs> = {
  title: 'Core/Navigation/Tabs',
  component: Tabs,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: localizedRender(() => (
    <div style={{ width: 480, maxWidth: '90vw' }}>
      <TabsExample />
    </div>
  )),
};

export const Appearances: Story = {
  render: localizedRender(() => (
    <div style={{ width: 560, maxWidth: '90vw' }}>
      <StoryLayoutStack gap="xl">
        {(['line', 'outline', 'pills'] as const).map((appearance) => (
          <div key={appearance}>
            <DsLayoutInset blockEnd="xs">
              <DsText size="xs" tone="secondary">
                {appearance}
              </DsText>
            </DsLayoutInset>
            <TabsExample appearance={appearance} />
          </div>
        ))}
      </StoryLayoutStack>
    </div>
  )),
};

// Stateful examples share this component's catalog entry with its fixed states.
type PlaygroundStory = StoryObj<typeof TabsPreview>;
export const Playground: PlaygroundStory = {
  render: (args) => <TabsPreview {...args} />,
  args: { appearance: 'line' },
  argTypes: { appearance: { control: 'select', options: ['line', 'outline', 'pills'] } },
  parameters: { layout: 'fullscreen', canvasInset: 'none' },
};
