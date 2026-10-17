import { LayoutStack as StoryLayoutStack, LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { TextButton } from '@/components/core/TextButton';
import { Text as DsText } from '@/components/core/Typography';

import { localizedRender } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { Disclosure, type DisclosureProps } from './Disclosure';

function DisclosureExample(props: Omit<DisclosureProps, 'opened' | 'onChange'>) {
  return <Disclosure {...props} />;
}

const meta = {
  title: 'Core/Interaction/Disclosure',
  component: Disclosure,
  parameters: { layout: 'centered' },
  args: {
    label: 'Address details',
    children: <DsText size="sm">All visible copy and content are supplied by the consumer.</DsText>,
  },
} satisfies Meta<typeof Disclosure>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: localizedRender((args) => <DisclosureExample {...args} />),
};

export const CompactFilled: Story = {
  render: localizedRender((args) => (
    <div style={{ width: 280 }}>
      <StoryLayoutStack gap="xxs">
        <DisclosureExample
          {...args}
          label="Explore"
          appearance="filled"
          density="compact"
          shape="square"
          contentIndent="small"
        >
          <DsLayoutStack gap="none">
            <DsText size="xs">Artists</DsText>
            <DsText size="xs">Works</DsText>
          </DsLayoutStack>
        </DisclosureExample>
      </StoryLayoutStack>
    </div>
  )),
};

export const Disabled: Story = {
  args: {
    label: 'Unavailable details',
    disabled: true,
  },
};

export const Hovered: Story = {
  parameters: { pseudo: { hover: true } },
};

export const LeadingChevron: Story = {
  name: 'Hierarchy Leading Chevron',
  args: { label: 'Parent group', chevronPosition: 'start' },
};

export const NestedDetails: Story = {
  render: localizedRender((args) => (
    <DisclosureExample {...args} defaultOpened>
      <Disclosure label="Settings" withDivider={false}>
        <DsText size="sm">Optional field settings</DsText>
      </Disclosure>
    </DisclosureExample>
  )),
};

/** Navigation groups: label on the chrome rows' `xs` line, the same start as chrome links beside it. */
export const NavigationGroup: Story = {
  render: localizedRender(() => (
    <div style={{ width: 280 }}>
      <DsLayoutStack gap="none">
        <Disclosure label="Posts" density="chrome" withDivider={false} defaultOpened>
          <DsLayoutStack gap="none">
            <TextButton nested href="#posts" density="chrome" display="flex" fullWidth justify="start">
              <DsText size="xs">All posts</DsText>
            </TextButton>
            <TextButton nested href="#series" density="chrome" display="flex" fullWidth justify="start">
              <DsText size="xs">Series</DsText>
            </TextButton>
          </DsLayoutStack>
        </Disclosure>
        <TextButton href="#works" density="chrome" display="flex" fullWidth justify="start">
          <DsText size="xs">Works</DsText>
        </TextButton>
      </DsLayoutStack>
    </div>
  )),
};

function NestedDetailsPreview({ children, ...props }: DisclosureProps) {
  return (
    <Disclosure {...props} defaultOpened density="compact" withDivider={false}>
      {children}
    </Disclosure>
  );
}

export const LabelAlignedHierarchy: Story = {
  render: localizedRender((args) => (
    <div style={{ width: 320 }}>
      <NestedDetailsPreview {...args} label="Parent group">
        <DsLayoutStack gap="xxs">
          <DsText size="sm">Project details</DsText>
          <NestedDetailsPreview label="Address details">
            <DsLayoutStack gap="xxs">
              <DsText size="sm">Optional field settings</DsText>
              <NestedDetailsPreview label="Settings">
                <DsText size="sm">All visible copy and content are supplied by the consumer.</DsText>
              </NestedDetailsPreview>
            </DsLayoutStack>
          </NestedDetailsPreview>
        </DsLayoutStack>
      </NestedDetailsPreview>
    </div>
  )),
};
