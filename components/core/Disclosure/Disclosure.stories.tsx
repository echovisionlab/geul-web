import type { Meta, StoryObj } from '@storybook/nextjs';

import { Stack, Text } from '@mantine/core';
import { Disclosure, type DisclosureProps } from './Disclosure';

function DisclosureExample(props: Omit<DisclosureProps, 'opened' | 'onChange'>) {
  return <Disclosure {...props} opened={false} onChange={() => {}} />;
}

const meta = {
  title: 'Core/Disclosure/Disclosure',
  component: Disclosure,
  parameters: { layout: 'centered' },
  args: {
    label: 'Project details',
    children: <Text size="sm">All visible copy and content are supplied by the consumer.</Text>,
  },
} satisfies Meta<typeof Disclosure>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <DisclosureExample {...args} />,
};

export const CompactFilled: Story = {
  render: (args) => (
    <Stack w={280} gap={2}>
      <DisclosureExample
        {...args}
        label="Explore"
        appearance="filled"
        density="compact"
        shape="square"
        contentIndent="small"
      >
        <Stack gap={0}>
          <Text size="xs">Artists</Text>
          <Text size="xs">Works</Text>
        </Stack>
      </DisclosureExample>
    </Stack>
  ),
};

export const Disabled: Story = {
  args: {
    label: 'Unavailable details',
    disabled: true,
  },
};
