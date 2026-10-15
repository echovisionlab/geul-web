import type { Meta, StoryObj } from '@storybook/nextjs';
import { LayoutStack } from '@/components/core/Layout';
import { FieldStatsChart } from './FieldStatsChart';
const meta: Meta<typeof FieldStatsChart> = {
  title: 'Feature/Form/Field Statistics',
  component: FieldStatsChart,
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof FieldStatsChart>;
export const Interactive: Story = {
  render: () => (
    <LayoutStack gap="xl">
      <FieldStatsChart
        fieldStat={{
          fieldId: 'artist',
          fieldName: 'Artist',
          fieldType: 'select',
          distribution: [
            { value: 'Monome', count: 7 },
            { value: 'TX–6', count: 5 },
            { value: 'T 1000', count: 3 },
            { value: '', count: 1 },
          ],
        }}
      />
      <FieldStatsChart
        fieldStat={{
          fieldId: 'date',
          fieldName: 'Date',
          fieldType: 'date',
          dateDistribution: [
            { date: '2026-10-08', count: 3 },
            { date: '2026-10-09', count: 7 },
            { date: '2026-10-10', count: 5 },
          ],
        }}
      />
      <FieldStatsChart
        fieldStat={{
          fieldId: 'score',
          fieldName: 'Score',
          fieldType: 'number',
          min: 0,
          max: 29,
          avg: 13.4,
          count: 15,
          histogram: [
            { bucket: 0, count: 3 },
            { bucket: 10, count: 7 },
            { bucket: 20, count: 5 },
          ],
        }}
      />
      <FieldStatsChart fieldStat={{ fieldId: 'empty', fieldName: 'Empty', fieldType: 'select', distribution: [] }} />
    </LayoutStack>
  ),
};
