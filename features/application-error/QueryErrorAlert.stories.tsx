import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { Stack } from '@mantine/core';
import { TextInput } from '@/components/core/Input';
import { QueryErrorAlert } from './QueryErrorAlert';

function QueryFailurePreview({ status = 503 }: { status?: number }) {
  const [failed, setFailed] = useState(true);
  return (
    <Stack maw={640} p="md">
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
      <TextInput label="편집 중인 제목" defaultValue="재시도해도 작성 내용은 유지됩니다" />
    </Stack>
  );
}
const meta: Meta<typeof QueryFailurePreview> = {
  title: 'Core/Feedback/QueryErrorAlert',
  component: QueryFailurePreview,
  argTypes: { status: { control: 'select', options: [400, 401, 403, 404, 429, 500, 503, 504] } },
};
export default meta;
type Story = StoryObj<typeof QueryFailurePreview>;
export const ServiceUnavailable: Story = { args: { status: 503 } };
export const Forbidden: Story = { args: { status: 403 } };
export const Unauthorized: Story = { args: { status: 401 } };
