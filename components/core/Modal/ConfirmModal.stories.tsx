import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { localizedRender } from '@/.storybook/fixture-i18n';
import { Button } from '../Button';
import { ConfirmModal } from './ConfirmModal';
import { confirmDialogs, ConfirmDialogHost } from './confirm-dialogs';
const meta: Meta<typeof ConfirmModal> = {
  title: 'Core/Overlays/ConfirmModal',
  component: ConfirmModal,
  parameters: { layout: 'centered' },
  args: {
    opened: true,
    onClose: () => {},
    onConfirm: () => {},
    title: 'Restore version',
    message: 'Restore to v12? The current state will be saved before restoring.',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    closeLabel: 'Close dialog',
  },
  render: localizedRender((args) => {
    const [opened, setOpened] = useState(args.opened);
    useEffect(() => setOpened(args.opened), [args.opened]);
    return (
      <>
        {!opened && <Button onClick={() => setOpened(true)}>{args.title}</Button>}
        <ConfirmModal {...args} opened={opened} onClose={() => setOpened(false)} onConfirm={() => setOpened(false)} />
      </>
    );
  }),
};
export default meta;
type Story = StoryObj<typeof ConfirmModal>;
export const Confirm: Story = {};
export const Destructive: Story = {
  args: {
    title: 'Delete release',
    message: 'This action permanently removes the release.',
    confirmLabel: 'Delete',
    confirmTone: 'danger',
    confirmEmphasis: 'strong',
  },
};
export const Loading: Story = { args: { ...Destructive.args, message: 'Deleting the release...', loading: true } };
export const Disabled: Story = {
  args: { ...Destructive.args, message: 'Select a release before continuing.', confirmDisabled: true },
};
export const CompactCentered: Story = {
  args: { confirmLabel: 'Restore', confirmTone: 'accent', centered: true, size: 'compact' },
};

/**
 * Imperative confirmation through `confirmDialogs.open()` and the application `ConfirmDialogHost`.
 * The host is on demand by default (the renderer loads with the first request, which waits in the
 * queue); `loading="eager"` loads it on mount, as here.
 */
export const QueuedConfirmation: Story = {
  render: localizedRender((args) => (
    <>
      <ConfirmDialogHost loading="eager" />
      <Button
        onClick={() =>
          confirmDialogs.open({
            title: args.title,
            message: args.message,
            confirmLabel: args.confirmLabel,
            cancelLabel: args.cancelLabel,
            closeLabel: args.closeLabel ?? 'Close dialog',
            onConfirm: () => undefined,
          })
        }
      >
        {args.title}
      </Button>
    </>
  )),
};
