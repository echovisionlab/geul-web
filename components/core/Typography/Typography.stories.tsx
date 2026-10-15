import type { Meta, StoryObj } from '@storybook/nextjs';
import { Text, Heading } from './Typography';
import { LayoutStack } from '../Layout';
const meta = { title: 'Core/Typography/Text', component: Text, args: { children: 'Name' } } satisfies Meta<typeof Text>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Body: Story = {};
export const Secondary: Story = { args: { tone: 'secondary' } };
export const Strong: Story = { args: { weight: 'strong' } };
export const Monospace: Story = { args: { font: 'mono' } };
export const Scale: Story = {
  render: (args) => (
    <LayoutStack>
      {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <Text key={size} {...args} size={size}>
          {size} · {args.children}
        </Text>
      ))}
    </LayoutStack>
  ),
};
export const HeadingLevels: Story = {
  render: (args) => (
    <LayoutStack>
      {([1, 2, 3, 4, 5, 6] as const).map((level) => (
        <Heading key={level} level={level}>
          {args.children}
        </Heading>
      ))}
    </LayoutStack>
  ),
};
