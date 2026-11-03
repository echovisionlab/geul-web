import type { Meta, StoryObj } from '@storybook/nextjs';
import { SectionCard } from '@/components/core/Section';
import { SortableClient } from './WorkClientsSection';

function ClientPreview({ state }: { state: 'loading' | 'missing' | 'failed' }) {
  return (
    <SectionCard>
      <SortableClient
        clientId="client"
        client={null}
        canEdit
        isLoading={state === 'loading'}
        isError={state === 'failed'}
        onRemove={() => {}}
        onRetry={() => {}}
        reorderAriaLabel="Reorder client"
        openWebsiteAriaLabel="Open website"
        removeAriaLabel="Remove client"
      />
    </SectionCard>
  );
}
const meta = {
  title: 'Feature/Work/Client Wait',
  component: ClientPreview,
  parameters: {
    docs: {
      description: {
        component:
          'Actual selected-client row. Missing and failed responses end the loader and retain removal; failed requests expose retry. Service responses are fixtures.',
      },
    },
  },
  args: { state: 'loading' },
} satisfies Meta<typeof ClientPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loading: Story = {};
export const Missing: Story = { args: { state: 'missing' } };
export const Failed: Story = { args: { state: 'failed' } };
