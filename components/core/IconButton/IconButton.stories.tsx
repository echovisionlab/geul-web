import { Text as StoryText } from '@/components/core/Typography';
import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { localizedRender } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import { IconCheck, IconGripVertical, IconMenu2, IconPencil, IconPlus, IconTrash, IconX } from '@tabler/icons-react';

import type { ControlEmphasis, ControlTone } from '../control-style';
import { useEffect, useState } from 'react';
import { IconButton, type IconButtonProps } from './IconButton';

function IconButtonExample(props: IconButtonProps) {
  if (props.href !== undefined) {
    return <IconButton {...props} />;
  }
  return <IconButton {...props} />;
}

function IconButtonToggleExample() {
  const [pressed, setPressed] = useState(false);
  return (
    <IconButton label="Edit mode" pressed={pressed} onClick={() => setPressed(!pressed)}>
      <IconPencil aria-hidden />
    </IconButton>
  );
}
import { Button } from '../Button';
import { Tooltip } from '../Tooltip';

const tones: ControlTone[] = ['accent', 'neutral', 'positive', 'warning', 'danger'];
const emphases: ControlEmphasis[] = ['strong', 'medium', 'low', 'outline'];

const meta: Meta<typeof IconButton> = {
  title: 'Core/Actions/IconButton',
  component: IconButton,
  parameters: { layout: 'centered' },
  render: localizedRender((args) => <IconButtonExample {...args} />),
  args: { label: 'Edit', children: <IconPencil size={18} aria-hidden /> },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Quiet: Story = {};
export const ButtonAlignedSizes: Story = {
  render: localizedRender(() => (
    <DsLayoutStack gap="sm">
      {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <DsLayoutInline key={size} gap="xs">
          <Button size={size} emphasis="medium" disabled>
            {size}
          </Button>
          <IconButtonExample size={size} label={`Delete ${size}`}>
            <IconTrash size={size === 'xs' ? 15 : 18} aria-hidden />
          </IconButtonExample>
        </DsLayoutInline>
      ))}
    </DsLayoutStack>
  )),
};
export const Primary: Story = {
  args: {
    tone: 'accent',
    emphasis: 'strong',
    label: 'Confirm',
    children: <IconCheck size={18} aria-hidden />,
  },
};
export const Danger: Story = {
  args: {
    tone: 'danger',
    label: 'Delete',
    children: <IconTrash size={18} aria-hidden />,
  },
};
export const Circular: Story = {
  args: {
    shape: 'circle',
    tone: 'danger',
    emphasis: 'strong',
    label: 'Remove',
    children: <IconX size={18} aria-hidden />,
  },
};
export const MediaOverlay: Story = {
  args: {
    tone: 'danger',
    emphasis: 'strong',
    label: 'Remove avatar',
    children: <IconX aria-hidden />,
  },
  render: localizedRender((args) => (
    <div
      style={{
        position: 'relative',
        width: 56,
        height: 56,
        borderRadius: 'var(--geul-radius-circle)',
        background: 'var(--geul-surface-muted)',
      }}
    >
      <IconButton
        appearance="media-overlay"
        placement="overlay-end-inside"
        label="Remove avatar"
        tone={args.tone}
        emphasis={args.emphasis}
        disabled={args.disabled}
        loading={args.loading}
      >
        {args.children}
      </IconButton>
    </div>
  )),
};
export const MediaOverlayHover: Story = {
  ...MediaOverlay,
  parameters: { pseudo: { hover: true } },
  play: async ({ canvasElement }) => {
    const remove = within(canvasElement).getByRole('button');
    await expect(getComputedStyle(remove).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    await expect(remove.firstElementChild?.getBoundingClientRect().width).toBe(16);
  },
};
export const MediaOverlayActive: Story = {
  ...MediaOverlayHover,
  parameters: { pseudo: { active: true } },
};
export const Disabled: Story = {
  args: { disabled: true, label: 'Disabled edit' },
};

export const LowEmphasisStates: Story = {
  render: localizedRender(() => (
    <DsLayoutInline gap="xs">
      <IconButtonExample label="Enabled neutral action" emphasis="low">
        <IconPencil size={18} aria-hidden />
      </IconButtonExample>
      <IconButtonExample label="Enabled danger action" tone="danger" emphasis="low">
        <IconTrash size={18} aria-hidden />
      </IconButtonExample>
      <IconButtonExample label="Disabled neutral action" emphasis="low" disabled>
        <IconPencil size={18} aria-hidden />
      </IconButtonExample>
      <IconButtonExample label="Disabled danger action" tone="danger" emphasis="low" disabled>
        <IconTrash size={18} aria-hidden />
      </IconButtonExample>
    </DsLayoutInline>
  )),
};

export const SemanticMatrix: Story = {
  render: localizedRender(() => (
    <DsLayoutStack gap="sm">
      {tones.map((tone) => (
        <DsLayoutInline key={tone} gap="xs" wrap="nowrap">
          <div style={{ width: 64, color: 'dimmed' }}>
            <StoryText size="xs">{tone}</StoryText>
          </div>
          {emphases.map((emphasis) => (
            <IconButtonExample key={emphasis} tone={tone} emphasis={emphasis} label={`${tone} ${emphasis}`}>
              <IconPencil size={18} aria-hidden />
            </IconButtonExample>
          ))}
        </DsLayoutInline>
      ))}
    </DsLayoutStack>
  )),
};

export const CountBadge: Story = {
  args: { label: 'Files', count: 9 },
  render: localizedRender((args) => <IconButtonExample {...args} />),
};
export const ZeroCount: Story = {
  args: { label: 'Files', count: 0 },
  render: localizedRender((args) => <IconButtonExample {...args} />),
};

export const DisabledDragHandle: Story = {
  render: () => (
    <IconButtonExample label="Reorder item" interaction="drag-handle" disabled>
      <IconGripVertical aria-hidden />
    </IconButtonExample>
  ),
};

/** Intrinsic SVG sizes must never decide the glyph geometry of Core controls. */
export const ChromeGlyphs: Story = {
  render: localizedRender(() => (
    <DsLayoutInline gap="none" wrap="nowrap">
      <IconButtonExample size="compact" label="Edit">
        <IconPencil aria-hidden />
      </IconButtonExample>
      <IconButtonExample size="compact" tone="danger" label="Delete">
        <IconTrash aria-hidden />
      </IconButtonExample>
      <IconButtonExample size="compact" label="Confirm">
        <span>
          <IconCheck aria-hidden />
        </span>
      </IconButtonExample>
    </DsLayoutInline>
  )),
};

/** `pressed` sets aria-pressed; Core owns the neutral resting ink and the muted selected surface. */
export const Toggle: Story = {
  render: localizedRender(() => <IconButtonToggleExample />),
};
export const ToggleStates: Story = {
  render: localizedRender(() => (
    <DsLayoutInline gap="xxs" role="group" aria-label="Text style">
      <IconButton label="Bold" pressed>
        <IconPencil aria-hidden />
      </IconButton>
      <IconButton label="Italic" pressed={false}>
        <IconPencil aria-hidden />
      </IconButton>
      <IconButton label="Underline" pressed disabled>
        <IconPencil aria-hidden />
      </IconButton>
    </DsLayoutInline>
  )),
};

export const Loading: Story = { args: { loading: true, label: 'Saving changes' } };
export const DisabledPending: Story = { args: { loading: true, disabled: true, label: 'Saving changes' } };

/** Native glyph paths retain their live area inside the shared 16px box. */
export const OpticalGlyphComparison: Story = {
  render: localizedRender(() => (
    <DsLayoutStack gap="xs">
      {(['compact', 'xs', 'chrome'] as const).map((size) => (
        <DsLayoutInline key={size} gap="xs">
          <StoryText size="xs">{size}</StoryText>
          <Tooltip label="Close">
            <IconButton size={size} aria-label="Close preview">
              <IconX aria-hidden />
            </IconButton>
          </Tooltip>
          <Tooltip label="Menu">
            <IconButton size={size} aria-label="Open menu">
              <IconMenu2 aria-hidden />
            </IconButton>
          </Tooltip>
          <Tooltip label="Add">
            <IconButton size={size} aria-label="Add item">
              <IconPlus aria-hidden />
            </IconButton>
          </Tooltip>
        </DsLayoutInline>
      ))}
    </DsLayoutStack>
  )),
};

function PendingTransitionExample() {
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!loading) {
      return;
    }
    const timeout = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timeout);
  }, [loading]);
  return (
    <Tooltip label="Save">
      <IconButton label="Save changes" count={9} loading={loading} onClick={() => setLoading(true)}>
        <IconCheck aria-hidden />
      </IconButton>
    </Tooltip>
  );
}

export const PendingTransition: Story = {
  render: localizedRender(() => <PendingTransitionExample />),
};

export const PendingWithBadge: Story = {
  args: { loading: true, count: 9, label: 'Save changes', children: <IconCheck aria-hidden /> },
};
