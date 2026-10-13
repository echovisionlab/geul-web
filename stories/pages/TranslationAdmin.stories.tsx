import { expect, userEvent, waitFor, within } from 'storybook/test';
import { operationsLabels } from './fixtures/operations-a11y';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutContainer } from '@/components/core/Layout';
import { TranslationOverviewPage } from '@/features/translation/admin/TranslationOverviewPage';
import { TranslationJobsPage } from '@/features/translation/admin/TranslationJobsPage';
import { TranslationSettingsPage } from '@/features/translation/admin/TranslationSettingsPage';
import { translationAdminFixture, type TranslationPreviewState } from './fixtures/translation-admin';
export function TranslationAdminPreview({
  surface = 'overview',
  state = 'ready',
}: {
  surface?: 'overview' | 'jobs' | 'settings';
  state?: TranslationPreviewState;
}) {
  const [client] = useState(() => translationAdminFixture(state));
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <LayoutContainer size="wide" inset="md">
        {surface === 'overview' ? (
          <TranslationOverviewPage client={client} />
        ) : surface === 'jobs' ? (
          <TranslationJobsPage client={client} />
        ) : (
          <TranslationSettingsPage client={client} />
        )}
      </LayoutContainer>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Admin/Translation',
  excludeStories: ['TranslationAdminPreview'],
  component: TranslationAdminPreview,
  args: { surface: 'overview', state: 'ready' },
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/admin/translations', query: {} } },
    docs: {
      description: {
        component:
          'Actual production overview, active-job and provider/settings controllers with typed in-memory RPC responses. Refresh, cancel, provider CRUD/toggle and dirty settings save use local state. Authentication, backend CAS, secrets, machine translation, WebSocket events and route navigation remain outside.',
      },
    },
  },
  decorators: [(Story, context) => <Story key={`${context.args.surface}:${context.args.state}`} />],
} satisfies Meta<typeof TranslationAdminPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {};
export const OverviewEmpty: Story = { args: { state: 'empty' } };
export const OverviewFailed: Story = { args: { state: 'error' } };
export const OverviewPending: Story = { args: { state: 'pending' } };
export const Jobs: Story = { args: { surface: 'jobs' } };
export const JobsEmpty: Story = { args: { surface: 'jobs', state: 'empty' } };
export const JobsFailed: Story = { args: { surface: 'jobs', state: 'error' } };
export const Settings: Story = { args: { surface: 'settings' } };
export const SettingsEmpty: Story = { args: { surface: 'settings', state: 'empty' } };
export const SettingsFailed: Story = { args: { surface: 'settings', state: 'error' } };
export const SettingsPending: Story = { args: { surface: 'settings', state: 'pending' } };
export const SaveFailed: Story = { args: { surface: 'settings', state: 'save-error' } };
export const Phone: Story = {
  args: { surface: 'settings' },
  globals: { viewport: { value: 'phone', isRotated: false } },
};

export const KeyboardJobCancellation: Story = {
  args: { surface: 'jobs' },
  tags: ['a11y-operations'],
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const t = await operationsLabels(globals);
    const table = await canvas.findByRole('table', { name: t.jobs('title') });
    const cancel = within(table).getByRole('button', { name: new RegExp(t.common('actions.cancel')) });
    await expect(cancel).toHaveAccessibleName(new RegExp('night-signals.*KO'));
    cancel.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent(t.jobs('states.empty')));
    await expect(canvas.getByRole('button', { name: t.common('actions.refresh') })).toHaveFocus();
  },
};
export const KeyboardProviderState: Story = {
  args: { surface: 'settings' },
  tags: ['a11y-operations'],
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const t = await operationsLabels(globals);
    const group = await canvas.findByRole('group', { name: 'Editorial translation' });
    const toggle = within(group).getByRole('switch', {
      name: `${t.providers('fields.providerActive.shortLabel')} Editorial translation`,
    });
    await expect(toggle).toBeChecked();
    toggle.focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(toggle).not.toBeChecked());
    const edit = within(group).getByRole('button', {
      name: `${t.providers('actions.editProvider')} Editorial translation`,
    });
    edit.focus();
    await userEvent.keyboard('{Enter}');
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await expect(dialog).toContainElement(canvasElement.ownerDocument.activeElement as HTMLElement);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(edit).toHaveFocus());
  },
};
