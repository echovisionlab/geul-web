import type { Meta, StoryObj } from '@storybook/nextjs';
import { Collection, CollectionMedia } from './Collection';
import { getCollectionMetrics, COLLECTION_SIZES } from './collection-contract';
import { LayoutInline, LayoutStack } from '../Layout';
import { Text } from '../Typography';

const meta: Meta<typeof Collection> = {
  title: 'Core/Data Display/Collection',
  component: Collection,
  parameters: { layout: 'padded' },
  args: { size: 'm' },
  argTypes: { size: { control: 'inline-radio', options: COLLECTION_SIZES } },
  render: ({ size }) => {
    const metrics = getCollectionMetrics(size);
    return (
      <Collection size={size}>
        <LayoutStack gap={metrics.rowGap}>
          {['Listening to the city after midnight', 'Notes from the archive'].map((title) => (
            <LayoutInline key={title} gap={metrics.rowGap} wrap="nowrap" align="start">
              <CollectionMedia width="thumbnail" aspectRatio="1:1" />
              <LayoutStack flexible gap={metrics.itemGap}>
                <Text size={metrics.titleSize} weight="medium" lines={2}>
                  {title}
                </Text>
                <Text size={metrics.metaSize} tone="secondary">
                  June Han · Journal
                </Text>
              </LayoutStack>
            </LayoutInline>
          ))}
        </LayoutStack>
      </Collection>
    );
  },
};
export default meta;
type Story = StoryObj<typeof Collection>;
export const Small: Story = { args: { size: 's' } };
export const Medium: Story = {};
export const Large: Story = { args: { size: 'l' } };
