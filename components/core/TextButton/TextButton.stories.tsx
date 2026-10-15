import { Text as StoryText } from '@/components/core/Typography';
import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { localizedRender } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';

import { useState } from 'react';
import { DropdownMenu } from '../DropdownMenu';
import { TextButton, type TextButtonProps } from './TextButton';

function TextButtonExample(props: TextButtonProps) {
  if (props.href !== undefined) {
    return <TextButton {...props} />;
  }
  return <TextButton {...props} />;
}

function TextButtonToggleExample() {
  const [pressed, setPressed] = useState(false);
  return (
    <TextButton aria-pressed={pressed} onClick={() => setPressed(!pressed)}>
      Bold
    </TextButton>
  );
}

const meta: Meta = {
  title: 'Core/Actions/TextButton',
  component: TextButton,
  tags: ['text-button'],
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: localizedRender(() => <TextButtonExample>Text action</TextButtonExample>),
};
export const Muted: Story = {
  render: localizedRender(() => <TextButtonExample appearance="muted">Cookie settings</TextButtonExample>),
};
export const Accent: Story = {
  render: localizedRender(() => <TextButtonExample appearance="accent">Learn more</TextButtonExample>),
};
export const AccentHover: Story = {
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
  render: localizedRender(() => <TextButtonExample appearance="accent">Hovered accent</TextButtonExample>),
};
export const Disabled: Story = {
  render: localizedRender(() => <TextButtonExample disabled>Unavailable</TextButtonExample>),
};
export const AccentDisabled: Story = {
  render: localizedRender(() => (
    <TextButtonExample appearance="accent" disabled>
      Unavailable accent
    </TextButtonExample>
  )),
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
  render: localizedRender(() => (
    <TextButtonExample appearance="accent" disabled>
      Hovered unavailable accent
    </TextButtonExample>
  )),
};
export const Link: Story = {
  render: localizedRender(() => <TextButtonExample href="#about">About</TextButtonExample>),
};
export const LinkHover: Story = {
  parameters: {
    pseudo: { hover: true },
    pseudoStateStyleTest: {
      selector: 'a',
      property: 'text-decoration-line',
      baseline: 'none',
      expected: 'underline',
    },
  },
  render: localizedRender(() => <TextButtonExample href="#about">About</TextButtonExample>),
};
export const FullWidth: Story = {
  parameters: { layout: 'padded' },
  render: localizedRender(() => (
    <TextButtonExample display="flex" fullWidth appearance="muted">
      Full-width action
    </TextButtonExample>
  )),
};
export const TypographyMatrix: Story = {
  render: localizedRender(() => (
    <DsLayoutStack gap="sm">
      {(['default', 'muted', 'accent'] as const).map((appearance) => (
        <DsLayoutInline key={appearance} gap="md" wrap="nowrap">
          <div style={{ width: 56, color: 'dimmed' }}>
            <StoryText size="xs">{appearance}</StoryText>
          </div>
          {(['xs', 'sm', 'md'] as const).map((size) => (
            <TextButtonExample key={size} appearance={appearance} size={size}>
              {size}
            </TextButtonExample>
          ))}
        </DsLayoutInline>
      ))}
    </DsLayoutStack>
  )),
};

export const MinimumControlGeometry: Story = {
  render: localizedRender(() => (
    <DsLayoutInline gap="md" align="start">
      {(['xs', 'sm', 'md'] as const).map((controlSize) => (
        <TextButtonExample
          key={controlSize}
          size={controlSize}
          controlSize={controlSize}
          data-testid={`control-${controlSize}`}
        >
          {controlSize}
        </TextButtonExample>
      ))}
    </DsLayoutInline>
  )),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const button of canvas.getAllByRole('button')) {
      const target = button.getBoundingClientRect();
      await expect(target.width).toBeGreaterThanOrEqual(24);
      await expect(target.height).toBeGreaterThanOrEqual(24);
    }
  },
};

export const StandaloneTargetGeometry: Story = {
  render: localizedRender(() => (
    <DsLayoutInline gap="xs">
      <TextButton size="xs">A</TextButton>
      <TextButton size="xs" display="inline">
        B
      </TextButton>
      <TextButton size="xs" href="#standalone-link">
        C
      </TextButton>
    </DsLayoutInline>
  )),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const targets = [...canvas.getAllByRole('button'), canvas.getByRole('link')].map((target) =>
      target.getBoundingClientRect(),
    );
    for (const target of targets) {
      await expect(target.width).toBeGreaterThanOrEqual(24);
      await expect(target.height).toBeGreaterThanOrEqual(24);
    }
    await expect(targets[0].right).toBeLessThanOrEqual(targets[1].left);
    await expect(targets[1].right).toBeLessThanOrEqual(targets[2].left);
  },
};

export const MobileMinimumControlGeometry: Story = {
  globals: { viewport: { value: 'phone', isRotated: false } },
  render: localizedRender(() => (
    <TextButtonExample size="xs" controlSize="xs" data-testid="control-xs-mobile">
      xs mobile
    </TextButtonExample>
  )),
};

export const CompactBlockAction: Story = {
  render: localizedRender(() => (
    <TextButtonExample appearance="accent" size="xs" weight="medium" display="block">
      Download file
    </TextButtonExample>
  )),
};

export const WidthContract: Story = {
  parameters: { layout: 'padded' },
  render: localizedRender(() => (
    <div data-testid="width-fixture" style={{ width: 320, display: 'flex', flexDirection: 'column' }}>
      <TextButtonExample data-testid="intrinsic-action">Intrinsic action</TextButtonExample>
      <TextButtonExample data-testid="full-width-action" display="flex" fullWidth>
        Full-width action
      </TextButtonExample>
    </div>
  )),
};

export const Toggle: Story = {
  render: localizedRender(() => <TextButtonToggleExample />),
};

export const CurrentLink: Story = {
  render: localizedRender(() => (
    <TextButton href="#current" selected aria-current="page">
      Current page
    </TextButton>
  )),
};

function LongMenuLabelExample({ nowrap = false }: { nowrap?: boolean }) {
  return (
    <div style={{ width: 240, maxWidth: '100%' }}>
      <DropdownMenu>
        <DropdownMenu.Target>
          <TextButton indicator="menu" fullWidth display="flex" nowrap={nowrap}>
            Language and regional formatting preferences
          </TextButton>
        </DropdownMenu.Target>
        <DropdownMenu.Dropdown>
          <DropdownMenu.Item>English</DropdownMenu.Item>
          <DropdownMenu.Item>Korean</DropdownMenu.Item>
        </DropdownMenu.Dropdown>
      </DropdownMenu>
    </div>
  );
}

export const LongMenuLabel: Story = {
  render: localizedRender(() => <LongMenuLabelExample />),
};

export const LongMenuLabelNoWrap: Story = {
  render: localizedRender(() => <LongMenuLabelExample nowrap />),
};
