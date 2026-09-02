import type { Meta, StoryObj } from '@storybook/nextjs';
import { TableOfContentsView } from './TableOfContentsView';

const meta: Meta<typeof TableOfContentsView> = {
  title: 'Core/Navigation/TableOfContents',
  component: TableOfContentsView,
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Contents',
    items: [
      { id: 'overview', label: 'Overview', level: 2 },
      { id: 'principles', label: 'Principles', level: 2 },
      { id: 'details', label: 'Details', level: 3 },
      { id: 'examples', label: 'Examples', level: 3 },
      { id: 'summary', label: 'Summary', level: 2 },
    ],
  },
};

export default meta;
type Story = StoryObj<typeof TableOfContentsView>;

export const Default: Story = {};
