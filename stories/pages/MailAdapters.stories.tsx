import { expect, userEvent, waitFor, within } from 'storybook/test';
import { operationsLabels } from './fixtures/operations-a11y';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutContainer } from '@/components/core/Layout';
import MailAdaptersPage from '@/features/admin/mail-adapter/MailAdaptersPage';
import { mailAdaptersFixture } from './fixtures/mail-adapters';
export function MailAdaptersPreview({ state = 'ready' }: { state?: Parameters<typeof mailAdaptersFixture>[0] }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [bindings] = useState(() => mailAdaptersFixture(state));
  return (
    <QueryClientProvider client={client}>
      <LayoutContainer size="wide" inset="md">
        <MailAdaptersPage bindings={bindings} />
      </LayoutContainer>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Admin/Mail Adapters',
  excludeStories: ['MailAdaptersPreview'],
  component: MailAdaptersPreview,
  args: { state: 'ready' },
  render: (args) => <MailAdaptersPreview key={args.state} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Actual mail adapter page controller and create/edit/test/delete dialogs with typed local action transport. Logging and SMTP fixtures, all three configuration forms, verified-test gate and Switch updates use production code. No mail is sent, credentials are not real, and server configuration validation/authorization are outside.',
      },
    },
  },
} satisfies Meta<typeof MailAdaptersPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Empty: Story = { args: { state: 'empty' } };
export const Failed: Story = { args: { state: 'failed' } };
export const Pending: Story = { args: { state: 'pending' } };
export const ActionFailed: Story = { args: { state: 'action-failed' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

export const KeyboardAdapterState: Story = {
  tags: ['a11y-operations'],
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const t = await operationsLabels(globals);
    const group = await canvas.findByRole('group', { name: 'Studio SMTP' });
    const toggle = within(group).getByRole('switch', { name: `${t.mail('row.enableAdapter')} Studio SMTP` });
    await expect(toggle).not.toBeChecked();
    toggle.focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(toggle).toBeChecked());
    const edit = within(group).getByRole('button', { name: `${t.common('actions.edit')} Studio SMTP` });
    edit.focus();
    await userEvent.keyboard('{Enter}');
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await expect(dialog).toContainElement(canvasElement.ownerDocument.activeElement as HTMLElement);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(edit).toHaveFocus());
  },
};
