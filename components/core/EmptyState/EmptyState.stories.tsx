import type { Meta, StoryObj } from '@storybook/nextjs';
import { IconFileText, IconFolder, IconMail } from '@tabler/icons-react';
import { localizedRender } from '@/.storybook/fixture-i18n';
import { Button } from '../Button';
import { SectionCard } from '../Section';
import { EmptyState } from './EmptyState';

const meta = {
  title: 'Core/Feedback/EmptyState',
  component: EmptyState,
  parameters: { layout: 'padded' },
  args: { title: 'No email templates yet.', icon: IconMail },
} satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithDescription: Story = {
  args: { title: 'No mail adapters.', description: 'Add an adapter to send transactional email.', live: true },
};
export const WithAction: Story = {
  render: localizedRender((args) => (
    <EmptyState
      {...args}
      icon={IconFileText}
      title="No versions found."
      action={<Button emphasis="medium">Create the first version</Button>}
    />
  )),
};
export const TextOnly: Story = { args: { icon: undefined, title: 'This folder is empty.' } };
export const InsideCard: Story = {
  render: localizedRender(() => (
    <SectionCard withBorder padding="xl">
      <EmptyState inset="none" icon={IconFolder} title="This folder is empty." />
    </SectionCard>
  )),
};
export const LongContent: Story = {
  args: {
    title: 'No published translations match the selected locale, entity type and review state.',
    description:
      'Clear one of the filters or request a translation. Long localized copy wraps within the available width.',
  },
};
