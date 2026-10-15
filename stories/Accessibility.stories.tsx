import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useStorybookText } from '@/.storybook/fixture-i18n';
import { Button } from '@/components/core/Button';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { TextInput } from '@/components/core/Input';
import { LayoutStack } from '@/components/core/Layout';
import { FormModal } from '@/components/core/Modal';

const meta = {
  title: 'Core/Interaction/Accessibility',
  tags: ['a11y-smoke'],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function KeyboardForm() {
  const text = useStorybookText();
  const [saved, setSaved] = useState(false);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(true);
      }}
    >
      <LayoutStack>
        <TextInput label={text('Name')} />
        <Button disabled>{text('Disabled')}</Button>
        <Button type="submit">{text('Save')}</Button>
        {saved && <div role="status">{text('Saved')}</div>}
      </LayoutStack>
    </form>
  );
}

export const KeyboardFormSubmission: Story = {
  render: () => <KeyboardForm />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox');
    const buttons = canvas.getAllByRole('button');
    await userEvent.tab();
    await expect(input).toHaveFocus();
    await userEvent.keyboard('Example');
    await userEvent.tab();
    await expect(buttons[0]).toBeDisabled();
    await expect(buttons[1]).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('status')).toBeVisible();
  },
};

function KeyboardMenu() {
  const text = useStorybookText();
  const [action, setAction] = useState('');
  return (
    <>
      <DropdownMenu>
        <DropdownMenu.Target>
          <Button>{text('File actions')}</Button>
        </DropdownMenu.Target>
        <DropdownMenu.Dropdown>
          <DropdownMenu.Item onClick={() => setAction(text('New file'))}>{text('New file')}</DropdownMenu.Item>
          <DropdownMenu.Item disabled>{text('Rename')}</DropdownMenu.Item>
          <DropdownMenu.Item onClick={() => setAction(text('Archive'))}>{text('Archive')}</DropdownMenu.Item>
        </DropdownMenu.Dropdown>
      </DropdownMenu>
      {action && <div role="status">{action}</div>}
    </>
  );
}

export const KeyboardMenuNavigation: Story = {
  render: () => <KeyboardMenu />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button');
    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    const menu = await body.findByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    await waitFor(() => expect(items[0]).toHaveFocus());
    await userEvent.keyboard('{ArrowDown}');
    await expect(items[1]).toHaveAttribute('aria-disabled', 'true');
    await expect(items[2]).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body.queryByRole('menu')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    // Finish with the portal visible so the accessibility scan checks the menu.
    await userEvent.keyboard('{ArrowDown}');
    await body.findByRole('menu');
  },
};

function KeyboardDialog() {
  const text = useStorybookText();
  const [opened, setOpened] = useState(false);
  const [title, setTitle] = useState('Sample release');
  const [savedTitle, setSavedTitle] = useState('');
  return (
    <>
      <Button onClick={() => setOpened(true)}>{text('Edit release')}</Button>
      <FormModal
        opened={opened}
        onClose={() => setOpened(false)}
        onSubmit={() => {
          setSavedTitle(title);
          setOpened(false);
        }}
        title={text('Edit release')}
        submitLabel={text('Save')}
        cancelLabel={text('Cancel')}
        closeLabel={text('Close dialog')}
      >
        <TextInput
          label={text('Release title')}
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
        />
      </FormModal>
      {savedTitle && <div role="status">{savedTitle}</div>}
    </>
  );
}

export const KeyboardDialogFocus: Story = {
  render: () => <KeyboardDialog />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button');
    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    const dialog = await body.findByRole('dialog');
    await expect(dialog).toHaveAccessibleName();
    await waitFor(() => expect(dialog.contains(canvasElement.ownerDocument.activeElement)).toBe(true));
    const input = within(dialog).getByRole('textbox');
    input.focus();
    // A full traversal must stay inside the dialog and wrap back to the field.
    for (let index = 0; index < 4; index += 1) {
      await userEvent.tab();
      await expect(dialog.contains(canvasElement.ownerDocument.activeElement)).toBe(true);
    }
    await expect(input).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    // Finish with the portal visible so the accessibility scan checks the dialog.
    await userEvent.keyboard('{Enter}');
    await body.findByRole('dialog');
  },
};
