import { ButtonPreview } from '@/stories/shared/ButtonPreview';
import { previewStateControl } from '@/stories/shared/PreviewFrame';
import { Text as StoryText } from '@/components/core/Typography';
import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { localizedRender } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';
import type { ControlEmphasis, ControlTone } from '../control-style';
import { useState } from 'react';
import { Button, type ButtonProps } from './Button';
import { SaveButton } from './SaveButton';
import { DropdownMenu } from '../DropdownMenu';

function ButtonExample(props: ButtonProps) {
  if (props.href !== undefined) {
    return <Button {...props} />;
  }
  return <Button {...props} />;
}

function ButtonToggleExample() {
  const [pressed, setPressed] = useState(false);
  return (
    <Button aria-pressed={pressed} onClick={() => setPressed(!pressed)}>
      Bold
    </Button>
  );
}

const tones: ControlTone[] = ['accent', 'neutral', 'positive', 'warning', 'danger'];
const emphases: ControlEmphasis[] = ['strong', 'medium', 'low', 'outline'];

const meta: Meta<typeof Button> = {
  title: 'Core/Actions/Button',
  component: Button,
  parameters: { layout: 'centered' },
  args: { children: 'Button' },
  render: localizedRender((args) => <ButtonExample {...args} />),
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { tone: 'accent', emphasis: 'strong' } };
export const Secondary: Story = {
  args: { tone: 'neutral', emphasis: 'medium', children: 'Secondary' },
};
export const Quiet: Story = {
  args: { tone: 'neutral', emphasis: 'low', children: 'Quiet' },
};
export const Danger: Story = { args: { tone: 'danger', emphasis: 'strong', children: 'Delete' } };
/** Form and settings commits use SaveButton: a strong fill in the configured site color. */
export const Save: Story = {
  render: localizedRender(() => (
    <DsLayoutInline gap="sm">
      <Button tone="neutral" emphasis="low">
        Cancel
      </Button>
      <SaveButton type="button">Save</SaveButton>
      <SaveButton type="button" loading>
        Saving
      </SaveButton>
      <SaveButton type="button" disabled>
        Save
      </SaveButton>
    </DsLayoutInline>
  )),
};
export const Loading: Story = { args: { loading: true, children: 'Saving' } };
export const Disabled: Story = { args: { disabled: true, children: 'Disabled' } };

export const SemanticMatrix: Story = {
  render: localizedRender(() => (
    <DsLayoutStack gap="sm">
      {tones.map((tone) => (
        <DsLayoutInline key={tone} gap="xs">
          <div style={{ width: 64 }}>
            <StoryText size="xs" tone="muted">
              {tone}
            </StoryText>
          </div>
          {emphases.map((emphasis) => (
            <ButtonExample key={emphasis} tone={tone} emphasis={emphasis}>
              {emphasis}
            </ButtonExample>
          ))}
        </DsLayoutInline>
      ))}
    </DsLayoutStack>
  )),
};

export const MultilineLabel: Story = {
  render: localizedRender(() => (
    <ButtonExample labelWrap="wrap" fullWidth>
      Subscribe to newsletter updates
    </ButtonExample>
  )),
};

/** Filled controls use background feedback for every tone, with no inset pressed border. */
export const FilledPressed: Story = {
  render: localizedRender(() => (
    <DsLayoutInline gap="xs">
      {tones.map((tone) => (
        <ButtonExample key={tone} tone={tone} emphasis="strong">
          {tone}
        </ButtonExample>
      ))}
    </DsLayoutInline>
  )),
  parameters: { pseudo: { active: '[data-emphasis="strong"]' } },
};
export const FilledKeyboardFocus: Story = {
  ...FilledPressed,
  parameters: { pseudo: { focusVisible: '[data-emphasis="strong"]' } },
};

// Stateful examples share this component's catalog entry with its fixed states.
type PlaygroundStory = StoryObj<typeof ButtonPreview>;
export const Playground: PlaygroundStory = {
  render: (args) => <ButtonPreview {...args} />,
  args: { state: 'ready', tone: 'neutral', emphasis: 'medium' },
  argTypes: {
    state: previewStateControl,
    tone: { control: 'select', options: ['accent', 'neutral', 'positive', 'warning', 'danger'] },
    emphasis: { control: 'select', options: ['strong', 'medium', 'low'] },
  },
  parameters: { layout: 'fullscreen', canvasInset: 'none' },
};
export const PlaygroundPending: PlaygroundStory = { ...Playground, args: { ...Playground.args, state: 'pending' } };
export const PlaygroundDisabled: PlaygroundStory = { ...Playground, args: { ...Playground.args, state: 'disabled' } };

export const Toggle: Story = {
  render: localizedRender(() => <ButtonToggleExample />),
};

export const Default: Story = { args: { children: 'Save', tone: 'neutral', emphasis: 'medium' } };
export const DisabledPending: Story = { args: { loading: true, disabled: true, children: 'Saving' } };
export const TrailingIndicator: Story = {
  render: localizedRender(() => (
    <DropdownMenu>
      <DropdownMenu.Target>
        <Button indicator="menu">Options</Button>
      </DropdownMenu.Target>
      <DropdownMenu.Dropdown>
        <DropdownMenu.Item>Open details</DropdownMenu.Item>
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  )),
};
