import type { Meta, StoryObj } from '@storybook/nextjs';
import { ProcessingOverlay } from './ProcessingOverlay';
import { useTranslations } from 'next-intl';
import { expect, within } from 'storybook/test';
const meta = {
  title: 'Core/Feedback/ProcessingOverlay',
  component: ProcessingOverlay,
  parameters: {
    docs: {
      description: {
        component:
          'A covering media scrim with a bounded content width. The progress slot consumes the same Progress API as inline and route indicators; its actual dark surface selects image contrast. Titles and status details use Text xs. Additional children remain available for existing compositions. The wrapper covers pointer interaction in the positioned region; callers still own disabled/inert controls and focus management.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', height: 240 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProcessingOverlay>;
export default meta;
export const Processing: StoryObj<typeof meta> = {
  render: function Processing() {
    const t = useTranslations('common.states');
    return (
      <ProcessingOverlay progress={{ value: 45, title: t('loading'), status: '45%', 'aria-label': t('loading') }} />
    );
  },
  play: async ({ canvasElement }) => {
    const bar = within(canvasElement).getByRole('progressbar');
    await expect(bar).toHaveAttribute('data-core-progress');
    await expect(bar).toHaveAttribute('data-contrast', 'image');
    await expect(bar).toHaveAttribute('aria-valuenow', '45');
    await expect(bar).toHaveAccessibleDescription('45%');
    for (const text of bar.querySelectorAll('[data-core-typography="text"]')) {
      await expect(text).toHaveAttribute('data-size', 'xs');
      await expect(getComputedStyle(text).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    }
  },
};
