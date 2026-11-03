import { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { Button } from '../Button';
import { ErrorPageView } from './ErrorPageView';

const meta = {
  title: 'Core/Feedback/ErrorPage',
  component: ErrorPageView,
  parameters: { layout: 'fullscreen' },
  args: {
    code: '503',
    title: 'Service unavailable',
    actions: [{ label: 'Home', href: '/' }],
  },
} satisfies Meta<typeof ErrorPageView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AsyncRetry: Story = {
  render: function RetryPreview(args) {
    const finish = useRef<(() => void) | undefined>(undefined);
    return (
      <>
        <ErrorPageView
          {...args}
          actions={[
            {
              label: 'Retry',
              onClick: () =>
                new Promise<void>((resolve) => {
                  finish.current = resolve;
                }),
            },
            ...args.actions,
          ]}
        />
        <Button onClick={() => finish.current?.()}>Complete simulated retry</Button>
      </>
    );
  },
};
