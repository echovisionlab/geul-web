import type { Meta, StoryObj } from '@storybook/nextjs';
import { Box, Group, Stack, Text } from '@mantine/core';
import { SortableGroups, type SortableGroup, type SortableItem } from './SortableGroups';

interface ExampleItem extends SortableItem {
  name: string;
}

interface ExampleGroup extends SortableGroup<ExampleItem> {
  name: string;
}

const initialGroups: ExampleGroup[] = [
  {
    id: 'first',
    name: 'First group',
    items: [
      { id: 'one', name: 'First item' },
      { id: 'two', name: 'Second item' },
    ],
  },
  { id: 'second', name: 'Second group', items: [{ id: 'three', name: 'Third item' }] },
];

function SortableGroupsFixture() {
  return (
    <Box maw={480}>
      <SortableGroups<ExampleGroup, ExampleItem>
        groups={initialGroups}
        onGroupsChange={() => {}}
        getGroupLabel={(group) => group.name}
        getItemLabel={(item) => item.name}
        renderGroup={({ group, children, dragHandleProps, isDropTarget }) => (
          <Stack
            gap="xs"
            mb="md"
            p="md"
            bg={isDropTarget ? 'blue.0' : 'gray.0'}
            style={{ border: '1px solid var(--mantine-color-gray-3)' }}
          >
            <Group gap="xs" {...dragHandleProps.attributes} {...dragHandleProps.listeners}>
              <Text fw={600}>{group.name}</Text>
            </Group>
            {children}
          </Stack>
        )}
        renderItem={({ item, dragHandleProps }) => (
          <Box p="sm" bg="var(--mantine-color-body)" {...dragHandleProps.attributes} {...dragHandleProps.listeners}>
            {item.name}
          </Box>
        )}
      />
    </Box>
  );
}

const meta: Meta<typeof SortableGroups> = {
  title: 'Core/Interaction/SortableGroups',
  component: SortableGroups,
  parameters: { layout: 'padded' },
  render: () => <SortableGroupsFixture />,
};

export default meta;
type Story = StoryObj<typeof SortableGroups>;

export const GroupsAndItems: Story = {};
