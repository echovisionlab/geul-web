import { LayoutStack as StoryLayoutStack } from '@/components/core/Layout';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { QueryErrorAlert } from './QueryErrorAlert';

function QueryFailurePreview({ status = 503 }: { status?: number }) {
  const [failed, setFailed] = useState(true);
  return (
    <div style={{ maxWidth: 640, padding: 'var(--geul-spacing-md)' }}>
      <StoryLayoutStack>
        <QueryErrorAlert
          queries={[
            {
              isError: failed,
              error: { status },
              isFetching: false,
              refetch: async () => {
                setFailed(false);
              },
            },
          ]}
        />
      </StoryLayoutStack>
    </div>
  );
}
const meta: Meta<typeof QueryFailurePreview> = {
  parameters: { canvasInset: 'none' },
  title: 'Feature/Application Error/QueryErrorAlert',
  component: QueryFailurePreview,
  argTypes: { status: { control: 'select', options: [400, 401, 403, 404, 429, 500, 503, 504] } },
};
export default meta;
type Story = StoryObj<typeof QueryFailurePreview>;
export const ServiceUnavailable: Story = { args: { status: 503 } };
export const Forbidden: Story = { args: { status: 403 } };
export const Unauthorized: Story = { args: { status: 401 } };
