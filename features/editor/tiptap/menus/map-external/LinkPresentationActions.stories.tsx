import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import enMessages from '@/messages/en.json';
import type { LinkPresentation } from '../../link-presentation/link-presentation';
import { LinkPresentationActions, type LinkPresentationLabels } from './LinkPresentationActions';
import { SelectionMenuSurface } from './SelectionMenuPrimitives';

const labels: LinkPresentationLabels = enMessages.editorCommon.editor.runtimeLabels.linkPresentation;

function LinkPresentationMenuPreview({
  presentations,
  initial,
  refreshable = false,
  refreshing = false,
}: {
  presentations: LinkPresentation[];
  initial: LinkPresentation;
  refreshable?: boolean;
  refreshing?: boolean;
}) {
  const [current, setCurrent] = useState(initial);
  return (
    <SelectionMenuSurface label={labels.menu} testId="tiptap-link-presentation-menu" navigationEnabled>
      <LinkPresentationActions
        labels={labels}
        presentations={presentations}
        current={current}
        onChange={setCurrent}
        onRefresh={refreshable ? () => undefined : undefined}
        refreshing={refreshing}
      />
    </SelectionMenuSurface>
  );
}

const meta = {
  title: 'Feature/Editor/Link Presentation Menu',
  component: LinkPresentationMenuPreview,
  parameters: { layout: 'padded' },
  args: { presentations: ['link', 'card'], initial: 'link' },
} satisfies Meta<typeof LinkPresentationMenuPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Shown right after a single URL is pasted; the link stays as it is unless another choice is made. */
export const PastedLink: Story = {
  play: async ({ canvasElement }) => {
    const toolbar = within(canvasElement).getByRole('toolbar');
    const card = within(toolbar).getByRole('button', { name: labels.asCard });
    await userEvent.click(card);
    await expect(card).toHaveAttribute('aria-pressed', 'true');
  },
};
/** A pasted YouTube or Vimeo URL offers the video first, as Notion does, and the plain link last. */
export const PastedVideoLink: Story = { args: { presentations: ['video', 'card', 'link'], initial: 'video' } };
export const SelectedCard: Story = { args: { initial: 'card', refreshable: true } };
export const RefreshingPreview: Story = { args: { initial: 'card', refreshable: true, refreshing: true } };
