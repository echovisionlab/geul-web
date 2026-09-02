import type { Meta, StoryObj } from '@storybook/nextjs';
import { Group, Stack, Text } from '@mantine/core';

import { TextButton, type TextButtonStyle } from './TextButton';

const attachmentActionStyle = {
  '--text-button-min-height': '0px',
  '--text-button-padding-block': '0px',
  '--text-button-padding-inline': '0px',
  '--text-button-line-height': 1.2,
} satisfies TextButtonStyle;

const meta: Meta = {
  title: 'Core/TextButton',
  component: TextButton,
  tags: ['text-button'],
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => <TextButton>Text action</TextButton>,
};
export const Muted: Story = {
  render: () => <TextButton appearance="muted">Cookie settings</TextButton>,
};
export const Accent: Story = {
  render: () => <TextButton appearance="accent">Learn more</TextButton>,
};
export const AccentHover: Story = {
  parameters: {
    pseudo: { hover: true },
    pseudoStateStyleTest: {
      selector: 'button',
      property: 'text-decoration-line',
      baseline: 'none',
      expected: 'underline',
    },
  },
  render: () => <TextButton appearance="accent">Hovered accent</TextButton>,
};
export const Disabled: Story = {
  render: () => <TextButton disabled>Unavailable</TextButton>,
};
export const AccentDisabled: Story = {
  render: () => (
    <TextButton appearance="accent" disabled>
      Unavailable accent
    </TextButton>
  ),
};
export const AccentDisabledHover: Story = {
  parameters: {
    pseudo: { hover: true },
    pseudoStateStyleTest: {
      selector: 'button',
      property: 'text-decoration-line',
      baseline: 'none',
      expected: 'none',
      force: true,
    },
  },
  render: () => (
    <TextButton appearance="accent" disabled>
      Hovered unavailable accent
    </TextButton>
  ),
};
export const Link: Story = {
  render: () => <TextButton href="/about">About</TextButton>,
};
export const FullWidth: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <TextButton display="flex" fullWidth appearance="muted">
      Full-width action
    </TextButton>
  ),
};
export const TypographyMatrix: Story = {
  render: () => (
    <Stack gap="sm">
      {(['default', 'muted', 'accent'] as const).map((appearance) => (
        <Group key={appearance} gap="md" wrap="nowrap">
          <Text w={56} size="xs" c="dimmed">
            {appearance}
          </Text>
          {(['xs', 'sm', 'md'] as const).map((size) => (
            <TextButton key={size} appearance={appearance} size={size}>
              {size}
            </TextButton>
          ))}
        </Group>
      ))}
    </Stack>
  ),
};

export const MinimumControlGeometry: Story = {
  render: () => (
    <Group gap="md" align="flex-start">
      {(['xs', 'sm', 'md'] as const).map((controlSize) => (
        <TextButton
          key={controlSize}
          size={controlSize}
          controlSize={controlSize}
          data-testid={`control-${controlSize}`}
        >
          {controlSize}
        </TextButton>
      ))}
    </Group>
  ),
};

export const MobileMinimumControlGeometry: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => (
    <TextButton size="xs" controlSize="xs" data-testid="control-xs-mobile">
      xs mobile
    </TextButton>
  ),
};

export const CompactBlockAction: Story = {
  render: () => (
    <TextButton appearance="accent" size="xs" weight="medium" display="block" style={attachmentActionStyle}>
      Download file
    </TextButton>
  ),
};

export const WidthContract: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <div data-testid="width-fixture" style={{ width: 320, display: 'flex', flexDirection: 'column' }}>
      <TextButton data-testid="intrinsic-action">Intrinsic action</TextButton>
      <TextButton data-testid="full-width-action" display="flex" fullWidth>
        Full-width action
      </TextButton>
    </div>
  ),
};
