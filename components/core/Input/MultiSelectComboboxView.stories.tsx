import type { Meta, StoryObj } from '@storybook/nextjs';
import { useArgs } from 'storybook/preview-api';
import { MultiSelectComboboxView, type MultiSelectItem } from './MultiSelectComboboxView';

interface ExampleItem extends MultiSelectItem {
  description: string;
}
const options: ExampleItem[] = [
  { id: 'ambient', name: 'Ambient', description: 'Atmospheric music' },
  { id: 'electronic', name: 'Electronic', description: 'Electronic music' },
  { id: 'experimental', name: 'Experimental', description: 'Experimental music' },
];
const meta = {
  title: 'Core/Input/MultiSelectComboboxView',
  component: MultiSelectComboboxView<ExampleItem>,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Interactive local selection, removal and creation. Changes update the story controls; no taxonomy is persisted.',
      },
    },
  },
  render: function SelectionPreview(args) {
    const [, updateArgs] = useArgs();
    return (
      <MultiSelectComboboxView
        {...args}
        onSelect={(item) => {
          updateArgs({ selectedItems: [...args.selectedItems, item] });
          args.onSelect(item);
        }}
        onDeselect={(item) => {
          updateArgs({ selectedItems: args.selectedItems.filter((selected) => selected.id !== item.id) });
          args.onDeselect(item);
        }}
        onCreate={(name) => {
          const item: ExampleItem = { id: `created-${name}`, name, description: 'Created in this preview' };
          updateArgs({ options: [...args.options, item], selectedItems: [...args.selectedItems, item] });
          args.onCreate?.(name);
        }}
      />
    );
  },
  args: {
    label: 'Genres',
    placeholder: 'Select genres',
    emptyMessage: 'No genres available',
    notFoundMessage: 'No genres found',
    selectedItems: [options[0]],
    options,
    isLoading: false,
    onSelect: () => {},
    onDeselect: () => {},
    onCreate: () => {},
    createOptionLabel: (name: string) => `Create "${name}"`,
    canEdit: true,
    canCreateNew: true,
    combineWithSelected: true,
  },
} satisfies Meta<typeof MultiSelectComboboxView<ExampleItem>>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Editable: Story = {};
export const ReadOnly: Story = { args: { canEdit: false } };
export const Loading: Story = { args: { isLoading: true } };
