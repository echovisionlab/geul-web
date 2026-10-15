import type { Meta, StoryObj } from '@storybook/nextjs';
import { localizedRender } from '../../../.storybook/fixture-i18n';
import { SectionHeader } from './SectionHeader';
const meta = {
  title: 'Core/Layout/SectionHeader',
  component: SectionHeader,
  args: {
    title: 'Translations',
    description: 'Review the source language and existing translation document for each locale.',
    descriptionPlacement: 'below-row',
  },
  render: localizedRender((args) => <SectionHeader {...args} />),
} satisfies Meta<typeof SectionHeader>;
export default meta;
type Story = StoryObj<typeof meta>;
export const BelowRow: Story = {};
export const Grouped: Story = { args: { descriptionPlacement: 'with-title' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
