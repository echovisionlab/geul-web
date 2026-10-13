import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { localizedRender } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';
import type { ComponentType } from 'react';
import { expect, within } from 'storybook/test';

import { Progress, type ProgressProps } from './Progress';
type NamedProgressProps = Extract<ProgressProps, { 'aria-label': string }>;

const meta = {
  title: 'Core/Feedback/Progress',
  component: Progress as ComponentType<NamedProgressProps>,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The shared bar for measured progress and unknown-duration activity. value is 0–100, or null when progress cannot be measured. A separate accessible name is required. Optional title and status are visible Text xs; status extends the accessible description. size owns bar thickness. image contrast consumes existing image/overlay roles and requires an actual dark surface. RouteProgressBar and ProcessingOverlay compose this primitive; they own placement and covering behavior.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420, maxWidth: 'calc(100vw - 32px)' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    value: 42,
    'aria-label': 'Processing files',
  },
} satisfies Meta<NamedProgressProps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Determinate: Story = {};

export const WithStatus: Story = {
  args: { title: 'Processing files', status: 'Preparing your workspace…' },
  play: async ({ canvasElement }) => {
    const bar = within(canvasElement).getByRole('progressbar');
    await expect(bar).toHaveAttribute('aria-valuenow', '42');
    await expect(bar).toHaveAccessibleName();
    await expect(bar).toHaveAccessibleDescription();
    for (const text of bar.querySelectorAll('[data-core-typography="text"]')) {
      await expect(text).toHaveAttribute('data-size', 'xs');
    }
  },
};

export const Indeterminate: Story = {
  args: {
    value: null,
    'aria-label': 'Loading audio engine',
  },
};

export const SemanticTones: Story = {
  render: localizedRender(() => (
    <DsLayoutStack gap="sm">
      {(['accent', 'neutral', 'positive', 'warning', 'danger'] as const).map((tone, index) => (
        <DsLayoutStack key={tone} gap="xxs">
          <DsText size="xs" tone="secondary">
            {tone}
          </DsText>
          <Progress value={(index + 1) * 16} tone={tone} aria-label={`${tone} progress`} />
        </DsLayoutStack>
      ))}
    </DsLayoutStack>
  )),
};
