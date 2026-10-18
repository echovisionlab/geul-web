import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { withFeatureLabels } from '@/stories/feature-localization';
import { ContentLayoutFieldView, type ContentLayoutFieldViewProps } from './ContentLayoutFieldView';

function InteractiveField(args: ContentLayoutFieldViewProps) {
  const [value, setValue] = useState(args.value);
  return (
    <ContentLayoutFieldView
      {...args}
      value={value}
      onChange={(next) => {
        setValue(next);
        args.onChange(next);
      }}
    />
  );
}

const meta = {
  title: 'Feature/Document Layout/Content Layout Field',
  component: ContentLayoutFieldView,
  parameters: { layout: 'padded' },
  decorators: [
    withFeatureLabels({
      labels: {
        contentHeight: 'contentLayout.contentHeight',
        tableOfContents: 'tableOfContents.title',
        content: 'contentLayout.content',
        viewport: 'contentLayout.viewport',
        pageChrome: 'contentLayout.chrome',
        footer: 'contentLayout.footer',
        flow: 'contentLayout.flow',
        pinned: 'contentLayout.pinned',
      },
    }),
  ],
  args: {
    value: { contentHeight: 'content', pageChrome: 'flow', footer: 'flow' },
    labels: {
      contentHeight: 'Content height',
      tableOfContents: 'Table of contents',
      content: 'Content',
      viewport: 'Viewport',
      pageChrome: 'Content chrome',
      footer: 'Footer',
      flow: 'Flow',
      pinned: 'Pinned',
    },
    onChange: () => {},
  },
  render: (args) => <InteractiveField {...args} />,
} satisfies Meta<typeof ContentLayoutFieldView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {};
export const PinnedViewport: Story = {
  args: { value: { contentHeight: 'viewport', pageChrome: 'pinned', footer: 'pinned' } },
};
export const Disabled: Story = { args: { disabled: true } };
export const Narrow: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
