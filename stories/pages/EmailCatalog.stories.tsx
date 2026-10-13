import { expect, userEvent, within } from 'storybook/test';
import { operationsLabels } from './fixtures/operations-a11y';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutContainer } from '@/components/core/Layout';
import EmailLayoutsPage from '@/features/admin/email-layout/EmailLayoutsPage';
import EmailTemplatesPage from '@/features/admin/email-template/EmailTemplatesPage';
import { emailCatalogFixture, type EmailCatalogState } from './fixtures/email-catalog';
export function EmailCatalogPreview({
  domain = 'layouts',
  state = 'ready',
}: {
  domain?: 'layouts' | 'templates';
  state?: EmailCatalogState;
}) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [bindings] = useState(() => emailCatalogFixture(state));
  return (
    <QueryClientProvider client={client}>
      <LayoutContainer size="wide" inset="md">
        {domain === 'layouts' ? (
          <EmailLayoutsPage bindings={bindings.layouts} />
        ) : (
          <EmailTemplatesPage bindings={bindings.templates} />
        )}
      </LayoutContainer>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Admin/Email Catalog',
  excludeStories: ['EmailCatalogPreview'],
  component: EmailCatalogPreview,
  args: { domain: 'layouts', state: 'ready' },
  render: (args) => <EmailCatalogPreview key={`${args.domain}:${args.state}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Actual email layouts/templates controllers and original table, create/delete, safe HTML preview and event-mapping controls. Local typed readers/writes; reference-protected layout, system-template and editable custom-template rows. No live backend/email service/permission persistence. Detail authoring pages are separate.',
      },
    },
  },
} satisfies Meta<typeof EmailCatalogPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Layouts: Story = {};
export const LayoutsEmpty: Story = { args: { state: 'empty' } };
export const LayoutsFailed: Story = { args: { state: 'failed' } };
export const LayoutsPending: Story = { args: { state: 'pending' } };
export const LayoutsActionFailed: Story = { args: { state: 'action-failed' } };
export const Templates: Story = { args: { domain: 'templates' } };
export const TemplatesEmpty: Story = { args: { domain: 'templates', state: 'empty' } };
export const TemplatesFailed: Story = { args: { domain: 'templates', state: 'failed' } };
export const TemplatesPending: Story = { args: { domain: 'templates', state: 'pending' } };
export const TemplatesActionFailed: Story = { args: { domain: 'templates', state: 'action-failed' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

export const NamedTemplateMapping: Story = {
  args: { domain: 'templates' },
  tags: ['a11y-operations'],
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const t = await operationsLabels(globals);
    const custom = await canvas.findByRole('combobox', { name: `${t.common('labels.event')} Studio news` });
    const system = canvas.getByRole('combobox', { name: `${t.common('labels.event')} Login code` });
    await expect(system).not.toHaveValue('');
    await expect(custom).toHaveAccessibleName(`${t.common('labels.event')} Studio news`);
    await expect(
      canvas.getByRole('button', { name: t.dataTable('aria.rowActions', { label: 'Studio news' }) }),
    ).toBeEnabled();
    custom.focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(custom).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    await expect(custom).toHaveFocus();
  },
};
