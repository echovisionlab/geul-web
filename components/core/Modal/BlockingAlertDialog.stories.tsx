import { useArgs } from 'storybook/preview-api';
import { Button } from '../Button';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { BlockingAlertDialog } from './BlockingAlertDialog';

const meta: Meta<typeof BlockingAlertDialog> = {
  title: 'Core/Overlays/BlockingAlertDialog',
  component: BlockingAlertDialog,
  render: function OverlayPreview(args) {
    const [, updateArgs] = useArgs();
    return (
      <>
        {!args.opened && <Button onClick={() => updateArgs({ opened: true })}>{args.title}</Button>}
        <BlockingAlertDialog {...args} onAction={() => updateArgs({ opened: false })} />
      </>
    );
  },
  parameters: { layout: 'fullscreen' },
  args: {
    opened: true,
    onAction: () => {},
    title: 'Attention required',
    message: 'Review this message before continuing.',
    actionLabel: 'Confirm',
    level: 'info',
  },
  argTypes: {
    level: {
      control: 'inline-radio',
      options: ['info', 'warning', 'danger'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof BlockingAlertDialog>;

export const Info: Story = {};

export const Warning: Story = {
  args: {
    level: 'warning',
    title: 'Editing permission revoked',
    message: 'Changes made after permission was revoked will not be saved.',
  },
};

export const Danger: Story = {
  args: {
    level: 'danger',
    title: 'Connection permanently closed',
    message: 'This editor session cannot be recovered.',
  },
};

export const Loading: Story = {
  args: {
    level: 'warning',
    title: 'Editing permission revoked',
    message: 'Moving to a safe destination.',
    loading: true,
  },
};
