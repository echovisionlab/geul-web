import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, within } from 'storybook/test';
import { LayoutContainer } from '@/components/core/Layout';
import { localBackupEntries } from '@/stories/pages/fixtures/local-backups';
import type { LocalBackup } from '@/lib/collab/local-backups';
import { PageLoader } from '@/features/site/PageLoader';
import { LocalBackupsView } from './LocalBackupsView';

function Preview({
  initialEntries = localBackupEntries,
  error = false,
  unavailable = false,
  loading = false,
}: {
  initialEntries?: LocalBackup[];
  error?: boolean;
  unavailable?: boolean;
  loading?: boolean;
}) {
  const [backups, setBackups] = useState(initialEntries);
  return (
    <LayoutContainer size="standard" inset="md">
      <LocalBackupsView
        count={backups.length}
        bytes={backups.reduce((total, entry) => total + entry.bytes, 0)}
        error={error}
        loading={loading}
        loadingSurface={<PageLoader placement="flow" size="sm" minHeight={120} />}
        unavailable={unavailable}
        onRefresh={() => {}}
        onClear={async () => setBackups([])}
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
          'The account settings LocalBackupsView used in /my/settings: how many closed-tab backups this device keeps, their approximate size, and one action that deletes them all. The editor recovers a backup when its document is opened again, so backups are not listed one by one. Fixtures simulate IndexedDB journals; Delete all clears only fixture state. Check empty, several backups, confirmation/cancel/delete, narrow widths, keyboard focus, light/dark and English/Korean. This preview does not verify live session authorization or persistence.',
      },
    },
  },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SeveralEntries: Story = {};
export const Empty: Story = { args: { initialEntries: [] } };
export const DeleteAll: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByRole('status')).toHaveTextContent(/3/u);
    await userEvent.click(canvas.getByRole('button', { name: /^(Delete all|모두 삭제)$/u }));
    const dialog = await page.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^(Delete all|모두 삭제)$/u }));
    await expect(
      await canvas.findByText(/^(No backups from closed tabs to recover\.|닫힌 탭에서 복구할 백업이 없습니다\.)$/u),
    ).toBeVisible();
  },
};
export const LoadFailed: Story = { args: { initialEntries: [], error: true } };
export const StorageUnavailable: Story = { args: { initialEntries: [], unavailable: true } };
export const NarrowViewport: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

export const Loading: Story = { args: { initialEntries: [], loading: true } };
