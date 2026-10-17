import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useStorybookText } from '@/.storybook/fixture-i18n';
import { SiteHeader } from './SiteHeader';
import { ApplicationFrame } from './ApplicationFrame';
import { MenuToggle } from '../MenuToggle';
import { LayoutInline, LayoutStack } from '../Layout';
import { NavigationLink } from '../Navigation';
import { Heading, Text } from '../Typography';
const meta = {
  title: 'Core/Layout/ApplicationFrame',
  component: ApplicationFrame,
  subcomponents: { SiteHeader },
  parameters: { canvasInset: 'none', layout: 'fullscreen' },
} satisfies Meta<typeof ApplicationFrame>;
export default meta;
type Story = StoryObj<typeof meta>;
function SitePreview() {
  const [opened, setOpened] = useState(false),
    text = useStorybookText();
  return (
    <ApplicationFrame
      kind="site"
      header={
        <SiteHeader
          navigationToggle={
            <MenuToggle
              opened={opened}
              onClick={() => setOpened(!opened)}
              label={text('Menu')}
              controls="preview-site-nav"
              visibility="mobile-only"
            />
          }
          logo={
            <NavigationLink href="#content" appearance="graphic">
              Geul
            </NavigationLink>
          }
          desktopActions={
            <LayoutInline justify="end">
              <NavigationLink href="#content">{text('Home')}</NavigationLink>
            </LayoutInline>
          }
          mobileActions={<NavigationLink href="#content">{text('Home')}</NavigationLink>}
        />
      }
      navigation={
        <LayoutStack>
          <NavigationLink href="#content">{text('Home')}</NavigationLink>
        </LayoutStack>
      }
      navigationId="preview-site-nav"
      navigationOpened={opened}
      onCloseNavigation={() => setOpened(false)}
      navigationLabel={text('Navigation')}
      closeLabel={text('Close')}
      footer={<Text size="sm">Geul</Text>}
    >
      <Heading id="content" level={1}>
        {text('Content')}
      </Heading>
      <Text>{text('Project details')}</Text>
    </ApplicationFrame>
  );
}
function WorkspacePreview() {
  const [compact, setCompact] = useState(false),
    text = useStorybookText();
  return (
    <ApplicationFrame
      kind="workspace"
      navigationMode={compact ? 'compact' : 'expanded'}
      navigationToggle={{ label: text('Toggle navigation'), onToggle: () => setCompact(!compact) }}
      navigation={
        <LayoutStack>
          <Text>{compact ? 'G' : 'Geul'}</Text>
          <NavigationLink href="#content" appearance="quiet">
            {text('Settings')}
          </NavigationLink>
        </LayoutStack>
      }
    >
      <Heading id="content" level={1}>
        {text('Settings')}
      </Heading>
      <Text>{text('Project details')}</Text>
    </ApplicationFrame>
  );
}
export const Site: Story = {
  args: {
    kind: 'site',
    header: 'Geul',
    navigationOpened: false,
    onCloseNavigation: () => {},
    navigationLabel: 'Navigation',
    closeLabel: 'Close',
    children: 'Content',
  },
  render: () => <SitePreview />,
};
export const Workspace: Story = {
  args: { kind: 'workspace', navigationMode: 'expanded', children: 'Content' },
  render: () => <WorkspacePreview />,
};
