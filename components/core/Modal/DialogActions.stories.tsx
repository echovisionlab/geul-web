import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from '../Button';
import { LayoutStack } from '../Layout';
import { Text } from '../Typography';
import { ContentModal } from './ContentModal';
import { DialogActions } from './DialogActions';

const meta = {
  title: 'Core/Overlays/DialogActions',
  component: DialogActions,
  parameters: { layout: 'centered' },
  args: {
    children: (
      <>
        <Button emphasis="low">Cancel</Button>
        <Button emphasis="strong">Save</Button>
      </>
    ),
  },
  render: (args) => (
    <ContentModal opened onClose={() => {}} title="Edit settings" closeLabel="Close dialog" size="standard" centered>
      <LayoutStack gap="sm">
        <Text size="sm">Review your changes before saving.</Text>
        <DialogActions {...args} id="dialog-actions-example" />
      </LayoutStack>
    </ContentModal>
  ),
} satisfies Meta<typeof DialogActions>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('dialog', { name: 'Edit settings' });
    const save = within(dialog).getByRole('button', { name: 'Save' });
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    const actions = canvasElement.ownerDocument.getElementById('dialog-actions-example')!;
    const bounds = actions.getBoundingClientRect();
    expect(Math.abs(save.getBoundingClientRect().right - bounds.right)).toBeLessThan(1);
    expect(save.getBoundingClientRect().width).toBeLessThan(bounds.width / 2);
    expect(cancel.getBoundingClientRect().right).toBeLessThan(save.getBoundingClientRect().left);
    cancel.focus();
    await userEvent.tab();
    expect(save).toHaveFocus();
  },
};
export const Phone: Story = {
  ...Default,
  globals: { viewport: { value: 'phone', isRotated: false } },
};
export const LongLabels: Story = {
  args: {
    children: (
      <>
        <Button emphasis="low">Cancel without saving changes</Button>
        <Button emphasis="strong">Save these settings</Button>
      </>
    ),
  },
  globals: { viewport: { value: 'phone', isRotated: false } },
};
export const SeparateDestructiveAction: Story = {
  args: {
    leadingActions: (
      <Button tone="danger" emphasis="low">
        Delete
      </Button>
    ),
  },
};
