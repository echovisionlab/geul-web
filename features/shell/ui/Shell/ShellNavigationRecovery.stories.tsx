import type { Meta, StoryObj } from '@storybook/nextjs';
import { ShellNavigationRecovery } from './ShellIslands';

const meta = {
  title: 'Feature/Shell/Navigation Recovery',
  component: ShellNavigationRecovery,
  args: {
    failureLabel: 'Failed to load data.',
    retryLabel: 'Try again',
    onRetry: () => {},
  },
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
    docs: {
      description: {
        component:
          'Production Core Alert/Button recovery after the mobile navigation chunk exhausts automatic retries. ShellRuntime supplies translated copy. This isolated view does not request a chunk; ShellNavigationRecovery.test.tsx covers terminal failure, explicit retry, focus and cancellation with the real Core hook.',
      },
    },
  },
} satisfies Meta<typeof ShellNavigationRecovery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const TerminalFailure: Story = {};
export const Korean: Story = {
  args: { failureLabel: '데이터를 불러오지 못했습니다.', retryLabel: '다시 시도' },
};
