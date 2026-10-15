import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, within } from 'storybook/test';
import { LayoutContainer } from '@/components/core/Layout';
import { localBackupEntries } from '@/stories/pages/fixtures/local-backups';
import type { LocalBackup } from '@/lib/collab/local-backups';
import { LocalBackupsView } from './LocalBackupsView';

function Preview({
  initialEntries = localBackupEntries,
  error = false,
  unavailable = false,
}: {
  initialEntries?: LocalBackup[];
  error?: boolean;
  unavailable?: boolean;
}) {
  const [backups, setBackups] = useState(initialEntries);
  return (
    <LayoutContainer size="standard" inset="md">
      <LocalBackupsView
        entries={backups}
        error={error}
        unavailable={unavailable}
        onRefresh={() => {}}
        onOpen={() => {}}
        onDiscard={async (entry) => setBackups((current) => current.filter((item) => item.id !== entry.id))}
      />
    </LayoutContainer>
  );
}
const meta = {
  title: 'Feature/My/Local Backups',
  component: Preview,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The account settings LocalBackupsView used in /my/settings. Orphan journal fixtures simulate IndexedDB and closed owners; opening is inert. Discard removes only fixture rows. Check empty, several rows, confirmation/cancel/discard, narrow widths, keyboard focus, light/dark and English/Korean. This preview does not verify live session authorization or persistence.',
      },
    },
  },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SeveralEntries: Story = {};
export const Empty: Story = { args: { initialEntries: [] } };
export const Discard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3);
    await userEvent.click(canvas.getAllByRole('button', { name: /^(Discard|버리기):/u })[0]!);
    const dialog = await page.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^(Discard|버리기)$/u }));
    await expect(canvas.getAllByRole('listitem')).toHaveLength(2);
  },
};
export const LoadFailed: Story = { args: { initialEntries: [], error: true } };
export const StorageUnavailable: Story = { args: { initialEntries: [], unavailable: true } };
export const NarrowViewport: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
