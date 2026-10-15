import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button } from '@/components/core/Button';
import { RejectedEditsDialog } from '@/features/authoring/EditorHeader/RejectedEditsDialog';
import type { RejectedEditorSave } from '@/lib/editor/editor-save-registry';

const discardSlug = fn();
const discardLayout = fn();

const rejected: RejectedEditorSave[] = [
  {
    patch: { slug: 'night-signals' },
    reason: 'AlreadyExists',
    message: 'Another post already uses this slug.',
    rejectedAt: 1,
    discard: discardSlug,
  },
  {
    patch: { documentLayout: { contentHeight: 'viewport', chrome: 'pinned', footer: 'flow' } },
    reason: 'PermissionDenied',
    message: 'You can no longer edit this post.',
    rejectedAt: 2,
    discard: discardLayout,
  },
];

function RejectedEditsPreview({ entries }: { entries: RejectedEditorSave[] }) {
  const [opened, setOpened] = useState(true);
  return (
    <>
      <Button onClick={() => setOpened(true)}>Review unsaved edits</Button>
      <RejectedEditsDialog opened={opened} onClose={() => setOpened(false)} rejected={entries} />
    </>
  );
}

const meta: Meta<typeof RejectedEditsPreview> = {
  title: 'Feature/Editor/Rejected Edits',
  component: RejectedEditsPreview,
  parameters: { layout: 'fullscreen' },
  args: { entries: rejected },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Review: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const dialog = await page.findByRole('dialog');
    const edits = within(dialog).getAllByTestId('rejected-edit');
    await expect(edits).toHaveLength(2);
    await expect(within(edits[0]!).getByText(/night-signals/u)).toBeInTheDocument();
    await userEvent.click(within(edits[1]!).getByRole('button', { name: /discard|버리기/iu }));
    await expect(discardLayout).toHaveBeenCalledOnce();
    await expect(discardSlug).not.toHaveBeenCalled();
  },
};

export const Empty: Story = { args: { entries: [] } };
