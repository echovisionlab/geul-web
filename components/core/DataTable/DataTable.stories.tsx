import { useState } from 'react';
import { localizedRender, useStorybookText } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { IconPlus } from '@tabler/icons-react';
import { expect, within } from 'storybook/test';
import { Button } from '../Button';
import { TextInput } from '../Input';
import { Text } from '../Typography';
import { LayoutStack } from '../Layout';
import { DataTableActions } from './DataTableActions';
import { DataTableSelectionToolbar } from './DataTableSelectionToolbar';
import { DataTableToolbar } from './DataTableToolbar';
const meta: Meta<typeof DataTableToolbar> = {
  title: 'Composition/Table Toolbars',
  component: DataTableToolbar,
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof DataTableToolbar>;
export const Toolbar: Story = {
  render: localizedRender(() => (
    <DataTableToolbar>
      <TextInput aria-label="Search records" placeholder="Search records" />
    </DataTableToolbar>
  )),
};
export const SelectionToolbar: Story = {
  render: localizedRender(() => {
    const [count, setCount] = useState(3);
    return (
      <DataTableSelectionToolbar
        search={<TextInput aria-label="Search artists" placeholder="Search artists" />}
        selectedCountLabel={`${count} selected`}
        actions={
          count > 0 ? (
            <Button emphasis="low" onClick={() => setCount(0)}>
              Clear selection
            </Button>
          ) : undefined
        }
      />
    );
  }),
};

export const ActionGroup: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Actual table commands consume the shared action-group gap and wrap with their toolbar. Commands update fixture state; no record is saved.',
      },
    },
  },
  render: localizedRender(() => {
    const [created, setCreated] = useState(0);
    const text = useStorybookText();
    return (
      <LayoutStack gap="xs">
        <DataTableToolbar>
          <TextInput aria-label="Search records" placeholder="Search records" />
          <DataTableActions>
            <Button leftSection={<IconPlus />} onClick={() => setCreated((count) => count + 1)}>
              Create
            </Button>
            <Button emphasis="low" onClick={() => setCreated(0)}>
              Reset
            </Button>
          </DataTableActions>
        </DataTableToolbar>
        <Text role="status" size="xs">
          {text('Created {name}', { name: created })}
        </Text>
      </LayoutStack>
    );
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = canvas.getAllByRole('button');
    const actions = buttons[0].parentElement!;
    const document = canvasElement.ownerDocument;
    const rootStyles = getComputedStyle(document.documentElement);
    const rootFontSize = Number.parseFloat(rootStyles.fontSize);
    const expectedGap =
      Number.parseFloat(rootStyles.getPropertyValue('--geul-spacing-role-action-group')) * rootFontSize;
    await expect(Number.parseFloat(getComputedStyle(actions).columnGap)).toBeCloseTo(expectedGap);
    const glyph = buttons[0].querySelector('svg')!;
    await expect(glyph.getBoundingClientRect().width).toBeCloseTo(16);
  },
};
